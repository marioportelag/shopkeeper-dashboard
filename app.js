require('dotenv').config();
const express = require('express');
const { create } = require('express-handlebars');
const pool = require('./db');

const app = express();

const hbs = create({ extname: '.hbs', defaultLayout: 'main', helpers: {
    json: function (context) {
        return JSON.stringify(context);
    }
}});
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');

app.use(express.static('public'));

app.get('/', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT s.id AS listing_id, s.title AS broker, EXTRACT(MONTH FROM d.listing_date) AS listing_month, 
               COUNT(*) AS total_listings, AVG(d.revenue) AS avg_revenue
        FROM deals d
        JOIN sites s ON d.site_id = s.id
        WHERE d.listing_date BETWEEN '2020-11-01' AND '2021-11-30'
        GROUP BY s.id, s.title, listing_month
        ORDER BY listing_month;
      `);

      const monthsDict = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
      ];

      const listings = result.rows.map((row) => ({
        listing_id: row.listing_id,
        listing_month: monthsDict[row.listing_month-1],
        broker: row.broker,
        total_listings: row.total_listings,
        avg_revenue: row.avg_revenue
      }));


      const labels = listings.map(listing => listing.listing_month);
      const data = listings.map(listing => listing.total_listings);


      const months = [...new Set(listings.map(item => item.listing_month))];
      const brokers = [...new Set(listings.map(item => item.broker))];

      const datasets = brokers.map(broker => {
      return {
            label: broker,
            data: months.map(month => {
                const listing = listings.find(item => item.broker === broker && item.listing_month === month);
                return listing ? parseInt(listing.total_listings) : 0; 
            }),
            fill: false,
            borderColor: `#${Math.floor(Math.random()*16777215).toString(16)}`, 
            tension: 0.1
        };
      });

      res.render('index', { listings, months, datasets });

    } catch (err) {
      console.error(err);
      res.status(500).send('Error fetching data');
    }
  });
  

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
