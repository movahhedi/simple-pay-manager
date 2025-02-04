import { Hono } from "hono";
import { FC } from "hono/jsx";
import { serve } from "@hono/node-server";
import { SqliteDialect, Kysely } from "kysely";
import SQLite from 'better-sqlite3';

console.log("Hello");

const dialect = new SqliteDialect({
	database: new SQLite("pay.db"),
});

export const db = new Kysely<Database>({
	dialect,
});

const people = [
	"HDP", "SEP", "SMY", "JSZ"
];

const Layout: FC = (props) => {
	return (
		<html>
			<body>{props.children}</body>
		</html>
	);
};

const app = new Hono().get("/", (c, next) => {
	let pageContent = (
		<>
			<section>
				<table>
					<thead>
						<tr>
							{people.map((i) => (
								<th>{i}</th>
							))}
						</tr>
					</thead>
					<tbody>
						<tr>
							{people.map((i) => (
								<td>1000</td>
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
							<th>توضیحات</th></tr>
					</thead>
					<tbody>
						<tr>
							<td>1</td>
							<td>محمد</td>
							<td>محمد</td>
							<td>1000</td>
							<td>1400/01/01</td>
							<td>خرید</td>
						</tr>
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
