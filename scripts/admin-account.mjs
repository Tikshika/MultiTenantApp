import nextEnv from "@next/env";
import { hash } from "bcryptjs";
import { Pool } from "pg";
import { createInterface } from "node:readline";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function promptLine(question) {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => readline.question(question, (answer) => {
    readline.close();
    resolve(answer.trim());
  }));
}

function promptSecret(question) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Password entry requires an interactive terminal so it is not echoed.");
  }

  return new Promise((resolve, reject) => {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    let value = "";

    const finish = (error) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") {
          finish(new Error("Cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else if (character >= " ") {
          value += character;
        }
      }
    };

    process.stdin.on("data", onData);
  });
}

async function main() {
  const operation = process.argv[2];
  if (!["create", "create-super-admin", "reset-password"].includes(operation)) {
    throw new Error("Use `npm run admin:create`, `npm run admin:create-super`, or `npm run admin:reset-password`.");
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");

  const email = (await promptLine("Admin email: ")).toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  const password = await promptSecret("Temporary password (12+ characters): ");
  if (password.length < 12 || password.length > 1024) {
    throw new Error("Password must be between 12 and 1024 characters.");
  }
  const confirmation = await promptSecret("Confirm password: ");
  if (password !== confirmation) throw new Error("Passwords do not match.");

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  });

  try {
    const passwordHash = await hash(password, 12);

    if (operation === "create" || operation === "create-super-admin") {
      const isSuperAdmin = operation === "create-super-admin";
      if (isSuperAdmin) {
        await pool.query(
          `insert into public.admin_accounts (email, password_hash, role, tenant_id, must_change_password)
           values ($1, $2, 'super_admin', null, true)`,
          [email, passwordHash],
        );
        process.stdout.write(`Super admin account created for ${email}. Ask the owner to change the temporary password after sign-in.\n`);
        return;
      }

      const tenantValue = process.env.SULTHAN_HARDWARE_TENANT_ID;
      if (!tenantValue || !/^[1-9]\d*$/.test(tenantValue) || !Number.isSafeInteger(Number(tenantValue))) {
        throw new Error("SULTHAN_HARDWARE_TENANT_ID must be a safe positive integer.");
      }

      const tenantId = Number(tenantValue);
      const result = await pool.query(
        `insert into public.admin_accounts (email, password_hash, role, tenant_id, must_change_password)
         select $1, $2, 'store_owner', tenant.id, true
           from public.tenants as tenant
          where tenant.id = $3
         returning id`,
        [email, passwordHash, tenantId],
      );
      if (!result.rows[0]) {
        throw new Error(`No tenant with ID ${tenantId} exists. Check SULTHAN_HARDWARE_TENANT_ID.`);
      }
      process.stdout.write(`Admin account created for ${email}. Ask the owner to change the temporary password after sign-in.\n`);
      return;
    }

    const result = await pool.query(
      `update public.admin_accounts
          set password_hash = $1,
              must_change_password = true,
              password_changed_at = now()
        where lower(email) = lower($2)
        returning id`,
      [passwordHash, email],
    );
    if (!result.rows[0]) throw new Error(`No admin account found for ${email}.`);
    await pool.query("delete from public.admin_sessions where admin_account_id = $1", [result.rows[0].id]);
    process.stdout.write(`Password reset for ${email}. The user must change it at next sign-in.\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Admin account command failed."}\n`);
  process.exitCode = 1;
});
