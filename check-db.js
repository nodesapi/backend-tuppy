const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const client = new Client({ connectionString: 'postgresql://postgres:password123@localhost:5432/tuppy_core_db?schema=public' });

client.connect()
  .then(() => client.query('SELECT id, email, password FROM "User" WHERE email=$1', ['demo@tupp.ly']))
  .then(async res => {
    if (res.rows.length > 0) {
      const user = res.rows[0];
      const match = await bcrypt.compare('password123', user.password);
      console.log('Password match for demo@tupp.ly:', match);
      console.log('Hash:', user.password);
    } else {
      console.log('User not found');
    }
    client.end();
  })
  .catch(e => console.error(e));
