import { Hono } from "hono";
import { FC } from "hono/jsx";
import { serve } from "@hono/node-server";
import { SqliteDialect, Kysely } from "kysely";
import SQLite from "better-sqlite3";

interface Database {
	person: PersonTable;
	record: RecordTable;
}

interface PersonTable {
	id: number;
	name: string;
	shortName: string;
}

interface RecordTable {
	id: number;
	amount: number;
	fromId: number;
	toId: number;
	date: string;
	memo: string;
}

// Initialize database connection
const db = new Kysely<Database>({
	dialect: new SqliteDialect({
		database: new SQLite("pay.db"),
	}),
});

// Create tables if they don't exist
async function initDatabase() {
	await db.schema
		.createTable("person")
		.ifNotExists()
		.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("shortName", "text", (col) => col.notNull())
		.execute();

	await db.schema
		.createTable("record")
		.ifNotExists()
		.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
		.addColumn("amount", "real", (col) => col.notNull())
		.addColumn("fromId", "integer", (col) => col.notNull().references("person.id"))
		.addColumn("toId", "integer", (col) => col.notNull().references("person.id"))
		.addColumn("date", "text", (col) => col.notNull())
		.addColumn("memo", "text", (col) => col.notNull())
		.execute();
}

const Layout: FC = (props) => {
	return (
		<html>
			<body>{props.children}</body>
		</html>
	);
};

const app = new Hono().get("/", async (c) => {
	await initDatabase();

	// Get all people
	const people = await db.selectFrom("person").select(["id", "shortName"]).execute();

	// Calculate balances
	const balances = await Promise.all(
		people.map(async (person) => {
			const fromSum = await db
				.selectFrom("record")
				.select((eb) => eb.fn.sum("amount").as("sum"))
				.where("fromId", "=", person.id)
				.executeTakeFirst();

			const toSum = await db
				.selectFrom("record")
				.select((eb) => eb.fn.sum("amount").as("sum"))
				.where("toId", "=", person.id)
				.executeTakeFirst();

			return {
				shortName: person.shortName,
				amount: Math.round(((fromSum?.sum || 0) - (toSum?.sum || 0)) * 1000) / 1000,
			};
		})
	);

	// Get all records
	const records = await db
		.selectFrom("record")
		.innerJoin("person as fromPerson", "fromPerson.id", "record.fromId")
		.innerJoin("person as toPerson", "toPerson.id", "record.toId")
		.select([
			"record.id",
			"record.amount",
			"fromPerson.name as fromName",
			"toPerson.name as toName",
			"record.date",
			"record.memo",
		])
		.execute();

	const pageContent = (
		<>
			<section>
				<table>
					<thead>
						<tr>
							{balances.map((p) => (
								<th>{p.shortName}</th>
							))}
						</tr>
					</thead>
					<tbody>
						<tr>
							{balances.map((p) => (
								<td>{p.amount}</td>
							))}
						</tr>
					</tbody>
				</table>
			</section>

			<section>
				<table>
					<thead>
						<tr>
							<th>آی‌دی</th>
							<th>از</th>
							<th>به</th>
							<th>مبلغ</th>
							<th>تاریخ</th>
							<th>توضیحات</th>
						</tr>
					</thead>
					<tbody>
						{records.map((record) => (
							<tr>
								<td>{record.id}</td>
								<td>{record.fromName}</td>
								<td>{record.toName}</td>
								<td>{record.amount}</td>
								<td>{record.date}</td>
								<td>{record.memo}</td>
							</tr>
						))}
					</tbody>
				</table>
			</section>
		</>
	);

	return c.html(<Layout>{pageContent}</Layout>);
});

serve({
	fetch: app.fetch,
	port: 8787,
});
