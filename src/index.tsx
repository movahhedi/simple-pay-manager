import { Hono } from "hono";
import { FC } from "hono/jsx";
import { serve } from "@hono/node-server";
import { SqliteDialect, Kysely } from "kysely";
import SQLite from "better-sqlite3";

console.log("Hello");


interface Database {
	person: PersonTable;
	record: RecordTable;
}

interface PersonTable {
	id: number;
	name: string;
	color: string;
}

interface RecordTable {
	id: number;
	amount: number;
	fromId: number;
	toId: number;
	date: string;
	memo: string;
	isPaid: number; // SQLite doesn't have boolean, using 0/1
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
		.addColumn("color", "text", (col) => col.notNull())
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
		.addColumn("isPaid", "integer", (col) => col.notNull().defaultTo(0))
		.execute();
}

const styles = {
	container: {
		padding: '20px',
		maxWidth: '1200px',
		margin: '0 auto',
	},
	section: {
		background: '#fff',
		borderRadius: '8px',
		padding: '20px',
		marginBottom: '20px',
		boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
	},
	table: {
		width: '100%',
		borderCollapse: 'collapse',
		marginBottom: '20px',
	},
	th: {
		padding: '12px',
		backgroundColor: '#f5f5f5',
		borderBottom: '2px solid #ddd',
	},
	td: {
		padding: '12px',
		borderBottom: '1px solid #ddd',
	},
	form: {
		display: 'flex',
		gap: '10px',
		alignItems: 'center',
	},
	input: {
		padding: '8px',
		borderRadius: '4px',
		border: '1px solid #ddd',
	},
	button: {
		padding: '8px 16px',
		borderRadius: '4px',
		border: 'none',
		backgroundColor: '#007bff',
		color: 'white',
		cursor: 'pointer',
	},
	badge: (color: string) => ({
		backgroundColor: color,
		color: 'white',
		padding: '4px 8px',
		borderRadius: '20px',
		display: 'inline-block',
		fontWeight: 'bold',
	}),
	actionButton: {
		padding: '4px 8px',
		borderRadius: '4px',
		border: 'none',
		cursor: 'pointer',
		marginRight: '4px',
		fontSize: '16px',
	},
	paidRecord: {
		backgroundColor: '#e8fff0',
		opacity: 0.8,
	},
};

function generateDarkColor() {
	const hue = Math.random() * 360;
	return `hsl(${hue}, 60%, 35%)`; // 35% lightness makes it dark enough for white text
}

function formatNumber(num: number) {
	return num.toLocaleString('en-US', {
		minimumFractionDigits: 0,
		maximumFractionDigits: 3
	});
}

const Layout: FC = (props) => (
	<html>
		<head>
			<meta charset="UTF-8" />
			<script dangerouslySetInnerHTML={{
				__html: `
					function showMessage(text, isError = false) {
						const msg = document.createElement('div');
						msg.style.position = 'fixed';
						msg.style.top = '20px';
						msg.style.right = '20px';
						msg.style.padding = '10px 20px';
						msg.style.borderRadius = '4px';
						msg.style.backgroundColor = isError ? '#ff4444' : '#44bb44';
						msg.style.color = 'white';
						msg.textContent = text;
						document.body.appendChild(msg);
						setTimeout(() => msg.remove(), 3000);
					}

					async function submitForm(formId, endpoint) {
						const form = document.getElementById(formId);
						if (!form) return;

						try {
							const formData = new FormData(form);
							const data = Object.fromEntries(formData);

							const response = await fetch(endpoint, {
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
								},
								body: JSON.stringify(data),
							});

							if (response.ok) {
								showMessage('Added successfully!');
								form.reset();
								setTimeout(() => window.location.reload(), 1000);
							} else {
								throw new Error('Submit failed');
							}
						} catch (error) {
							console.error('Error:', error);
							showMessage('Error: ' + error.message, true);
						}
					}

					async function handleAction(action, id, currentState = null) {
						const confirmMessages = {
							delete: "Are you sure you want to delete this record?",
							togglePaid: currentState ?
								"Mark this record as unpaid?" :
								"Mark this record as paid?",
						};

						if (action === 'edit') {
							const dialog = document.getElementById('editDialog');
							const form = document.getElementById('editForm');
							const record = JSON.parse(document.getElementById('record-'+id).dataset.record);

							// Fill form with current values
							form.elements.amount.value = record.amount;
							form.elements.fromId.value = record.fromId;
							form.elements.toId.value = record.toId;
							form.elements.date.value = record.date;
							form.elements.memo.value = record.memo;
							form.dataset.recordId = id;

							dialog.showModal();
							return;
						}

						if (!confirm(confirmMessages[action])) return;

						try {
							const response = await fetch(\`/record/\${action}/\${id}\`, {
								method: 'POST',
							});

							if (response.ok) {
								window.location.reload();
							} else {
								throw new Error('Action failed');
							}
						} catch (error) {
							showMessage('Error: ' + error.message, true);
						}
					}

					async function submitEdit(event) {
						event.preventDefault();
						const form = event.target;
						const id = form.dataset.recordId;

						try {
							const formData = new FormData(form);
							const data = Object.fromEntries(formData);

							const response = await fetch(\`/record/edit/\${id}\`, {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(data),
							});

							if (response.ok) {
								document.getElementById('editDialog').close();
								window.location.reload();
							}
						} catch (error) {
							showMessage('Error: ' + error.message, true);
						}
					}

					async function handlePersonEdit(id) {
						const person = JSON.parse(document.getElementById('person-'+id).dataset.person);
						const dialog = document.getElementById('editPersonDialog');
						const form = document.getElementById('editPersonForm');

						form.elements.name.value = person.name;
						form.elements.color.value = person.color;
						form.dataset.personId = id;

						dialog.showModal();
					}

					async function submitPersonEdit(event) {
						event.preventDefault();
						const form = event.target;
						const id = form.dataset.personId;

						try {
							const formData = new FormData(form);
							const data = Object.fromEntries(formData);

							const response = await fetch(\`/person/edit/\${id}\`, {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(data),
							});

							if (response.ok) {
								document.getElementById('editPersonDialog').close();
								window.location.reload();
							}
						} catch (error) {
							showMessage('Error: ' + error.message, true);
						}
					}
				`
			}}></script>
		</head>
		<body style={{ margin: 0, padding: 0, backgroundColor: '#f0f2f5', fontFamily: '"Segoe UI", sans-serif' }}>
			<div style={styles.container}>
				{props.children}
			</div>
			<dialog id="editPersonDialog" style={{
				padding: '20px',
				borderRadius: '8px',
				border: '1px solid #ddd',
			}}>
				<form id="editPersonForm" onsubmit="submitPersonEdit(event)">
					<h3>Edit Person</h3>
					<div style={{ display: 'grid', gap: '10px' }}>
						<input name="name" required style={styles.input} placeholder="Name" />
						<input name="color" type="color" required style={styles.input} />
						<div>
							<button type="submit" style={styles.button}>Save</button>
							<button type="button" onclick="editPersonDialog.close()" style={{
								...styles.button,
								backgroundColor: '#6c757d',
								marginLeft: '8px',
							}}>Cancel</button>
						</div>
					</div>
				</form>
			</dialog>
			<dialog id="editDialog" style={{
				padding: '20px',
				borderRadius: '8px',
				border: '1px solid #ddd',
			}}>
				<form id="editForm" onsubmit="submitEdit(event)">
					<h3>Edit Record</h3>
					<div style={{ display: 'grid', gap: '10px' }}>
						<select name="fromId" required style={styles.input}>
							{props.people?.map(p => <option value={p.id}>{p.name}</option>)}
						</select>
						<select name="toId" required style={styles.input}>
							{props.people?.map(p => <option value={p.id}>{p.name}</option>)}
						</select>
						<input name="amount" type="number" step="0.001" required style={styles.input} />
						<input name="date" type="date" required style={styles.input} />
						<input name="memo" required style={styles.input} />
						<div>
							<button type="submit" style={styles.button}>Save</button>
							<button type="button" onclick="editDialog.close()" style={{
								...styles.button,
								backgroundColor: '#6c757d',
								marginLeft: '8px',
							}}>Cancel</button>
						</div>
					</div>
				</form>
			</dialog>
		</body>
	</html>
);

const app = new Hono()
	.post('/person', async (c) => {
		const body = await c.req.json();
		await db
			.insertInto('person')
			.values({
				name: body.name,
				color: generateDarkColor(),
			})
			.execute();
		return c.json({ success: true });
	})
	.post('/person/edit/:id', async (c) => {
		const id = c.req.param('id');
		const body = await c.req.json();
		await db
			.updateTable('person')
			.set({
				name: body.name,
				color: body.color,
			})
			.where('id', '=', Number(id))
			.execute();
		return c.json({ success: true });
	})
	.post('/record', async (c) => {
		const body = await c.req.json();
		await db
			.insertInto('record')
			.values({
				fromId: Number(body.fromId),
				toId: Number(body.toId),
				amount: Number(body.amount),
				date: body.date,
				memo: body.memo,
			})
			.execute();
		return c.json({ success: true });
	})
	.post('/record/delete/:id', async (c) => {
		const id = c.req.param('id');
		await db.deleteFrom('record').where('id', '=', Number(id)).execute();
		return c.json({ success: true });
	})
	.post('/record/togglePaid/:id', async (c) => {
		const id = c.req.param('id');

		// First get the current state
		const record = await db
			.selectFrom('record')
			.select(['isPaid'])
			.where('id', '=', Number(id))
			.executeTakeFirst();

		if (!record) return c.json({ success: false });

		// Toggle the value
		const newValue = record.isPaid === 1 ? 0 : 1;

		// Update with new value
		await db
			.updateTable('record')
			.set({ isPaid: newValue })
			.where('id', '=', Number(id))
			.execute();

		return c.json({ success: true });
		})
	.post('/record/edit/:id', async (c) => {
		const id = c.req.param('id');
		const body = await c.req.json();
		await db
			.updateTable('record')
			.set({
				fromId: Number(body.fromId),
				toId: Number(body.toId),
				amount: Number(body.amount),
				date: body.date,
				memo: body.memo,
			})
			.where('id', '=', Number(id))
			.execute();
		return c.json({ success: true });
	})
	.get("/", async (c) => {
		await initDatabase();

		// Get all people
		const people = await db.selectFrom("person").select(["id", "name", "color"]).execute();

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

				const amount = Math.round(((Number(fromSum?.sum) || 0) - Number(toSum?.sum || 0)) * 1000) / 1000;
				return {
					id: person.id,
					name: person.name,
					amount: formatNumber(amount),
					color: person.color,
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
				"fromPerson.color as fromColor",
				"toPerson.color as toColor",
				"record.date",
				"record.memo",
				"record.isPaid",
			])
			.execute();

		const pageContent = (
			<>
				<section style={styles.section}>
					<h2>Add Person</h2>
						<form
							id="personForm"
							style={styles.form}
							onsubmit="event.preventDefault(); submitForm('personForm', '/person')"
							method="post"
						>
						<input style={styles.input} name="name" placeholder="Name" required />
						<button style={styles.button} type="submit">Add Person</button>
					</form>
				</section>

				<section style={styles.section}>
					<h2>Add Record</h2>
						<form
							id="recordForm"
							style={styles.form}
							onsubmit="event.preventDefault(); submitForm('recordForm', '/record')"
							method="post"
						>
						<select style={styles.input} name="fromId" required>
							<option value="">Select From</option>
							{people.map(p => <option value={p.id}>{p.name}</option>)}
						</select>
						<select style={styles.input} name="toId" required>
							<option value="">Select To</option>
							{people.map(p => <option value={p.id}>{p.name}</option>)}
						</select>
						<input style={styles.input} name="amount" type="number" step="0.001" placeholder="Amount" required />
						<input style={styles.input} name="date" type="date" required />
						<input style={styles.input} name="memo" placeholder="Memo" required />
						<button style={styles.button} type="submit">Add Record</button>
					</form>
				</section>

				<section style={styles.section}>
					<table style={styles.table}>
						<thead>
							<tr>
								{balances.map(p => (
									<th style={styles.th}>
										<span
											id={`person-${p.id}`}
											data-person={JSON.stringify(p)}
											style={{...styles.badge(p.color), cursor: 'pointer'}}
											onclick={`handlePersonEdit(${p.id})`}
											title="Click to edit"
										>
											{p.name}
										</span>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							<tr>
								{balances.map(p => <td style={styles.td}>{p.amount}</td>)}
							</tr>
						</tbody>
					</table>
				</section>

				<section style={styles.section}>
					<table style={styles.table}>
						<thead>
							<tr>
								<th style={styles.th}>ID</th>
								<th style={styles.th}>From</th>
								<th style={styles.th}>To</th>
								<th style={styles.th}>Amount</th>
								<th style={styles.th}>Date</th>
								<th style={styles.th}>Memo</th>
								<th style={styles.th}>Actions</th>
							</tr>
						</thead>
						<tbody>
							{records.map(record => (
								<tr id={`record-${record.id}`}
									data-record={JSON.stringify(record)}
									style={record.isPaid ? styles.paidRecord : undefined}>
									<td style={styles.td}>{record.id}</td>
									<td style={styles.td}>
										<span style={styles.badge(record.fromColor)}>
											{record.fromName}
										</span>
									</td>
									<td style={styles.td}>
										<span style={styles.badge(record.toColor)}>
											{record.toName}
										</span>
									</td>
									<td style={styles.td}>{formatNumber(record.amount)}</td>
									<td style={styles.td}>{record.date}</td>
									<td style={styles.td}>{record.memo}</td>
									<td style={styles.td}>
										<button
											onclick={`handleAction('togglePaid', ${record.id}, ${record.isPaid})`}
											style={styles.actionButton}
											title={record.isPaid ? "Mark as Unpaid" : "Mark as Paid"}
										>
											{record.isPaid ? '❌' : '✅'}
										</button>
										<button
											onclick={`handleAction('edit', ${record.id})`}
											style={styles.actionButton}
											title="Edit"
										>
											✏️
										</button>
										<button
											onclick={`handleAction('delete', ${record.id})`}
											style={styles.actionButton}
											title="Delete"
										>
											🗑️
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>
			</>
		);

		return c.html(<Layout people={people}>{pageContent}</Layout>);
	});

serve({
	fetch: app.fetch,
	port: 8787,
});
