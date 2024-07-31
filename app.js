// Import Express.js framework
const express = require('express');

// Code for body-parser
const bodyParser = require('body-parser');

// Create an instance of the Express application
const app = express();

// Middleware to parse request bodies
app.use(bodyParser.urlencoded({ extended: true }));

// Specify the port for the server to listen on
const port = 3000;

//Setting EJS as the view engine
app.set('view engine', 'ejs')

// enable static files
app.use(express.static('public'));

const multer = require('multer')

const mysql = require('mysql2');

const connection = mysql.createConnection({
    // host: 'localhost',
    // port: 3316,
    // user: 'root',
    // password: '',
    // database: 'c237_cafemenu'
    host: 'mysql-trexitan.alwaysdata.net',
    user: 'trexitan',
    password: 'tBimbimbap@22',
    database: 'trexitan_project'
});
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Set up
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

// enable form processing
app.use(express.urlencoded({
    extended: false
}));

app.get('/', (req, res) => {
    connection.query('SELECT * FROM products', (error, results) => {
        if (error) throw error;
        res.render('index', { products: results });
    });
});

app.get('/product', (req, res) => {
    res.render('product')
})


app.get('/product/:id', (req, res) => {
    const productId = req.params.id;
    const sql = 'SELECT * FROM products WHERE productId = ?';
    connection.query(sql, [productId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving product by ID');
        }
        if (results.length > 0) {
            res.render('product', { product: results[0] });
        } else {
            res.status(404).send('Product not found');
        }
    });
});

app.get('/editProduct', (req, res) => {
    res.render('editProduct')
})


app.get('/editProduct/:id', (req, res) => {
    const orderProductId = req.params.id;
    const getOrderProductSql = 'SELECT * FROM orderproducts WHERE orderproductId = ?';
    connection.query(getOrderProductSql, [orderProductId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving order product by ID');
        }
        if (results.length > 0) {
            const productId = results[0].productId;
            const quantity = results[0].quantity;
            const getProductSql = 'SELECT * FROM products WHERE productId = ?';
            connection.query(getProductSql, [productId], (error, results) => {
                if (error) {
                    console.error('Database query error:', error.message);
                    return res.status(500).send('Error Retrieving product by ID');
                }
                if (results.length > 0) {
                    const productWithQuantity = results[0];
                    productWithQuantity.quantity = quantity;
                    productWithQuantity.orderProductId = orderProductId;
                    res.render('editProduct', { product: productWithQuantity });
                } else {
                    res.status(404).send('Product not found');
                }
            });
        } else {
            res.status(404).send('Order product not found');
        }
    });
});


app.get('/cart', (req, res) => {
    res.render('cart')
})

app.get('/cart/:id', (req, res) => {
    const cartId = req.params.id;
    const sql = `
        SELECT 
            orders.orderId,  
            orderproducts.orderproductId,
            orderproducts.productId, 
            orderproducts.quantity, 
            products.productName, 
            products.image,
            products.price
        FROM orders
        JOIN orderproducts ON orders.orderId = orderproducts.orderId
        JOIN products ON orderproducts.productId = products.productId
        WHERE orders.orderId = ?`;

    connection.query(sql, [cartId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving cart by ID');
        }
        if (results.length > 0) {
            res.render('cart', { cart: results });
        } else if (results.length === 0) {
            res.status(404).send('Cart is empty');
        } else {
            res.status(404).send('Cart not found');
        }
    });
});


app.post('/addProduct', (req, res) => {
    const { productId, quantity, cartId } = req.body;
    // check if cartid is not empty,if exists, insert into existing cart(orderproducttable)
    if (cartId !== '') {   
        const sql = 'INSERT INTO orderproducts (orderId, productId, quantity) VALUES (?, ?, ?)';
        connection.query(sql, [cartId, productId, quantity], (error, results) => {
            if (error) {
                console.error('Error adding product:', error);
                res.status(500).send('Error adding Product');
            } else {
                console.log(results);
                res.redirect(`cart/${cartId}`);
            }
        });
    } else {
        // if cart is empty, we need to create a new order
        const sql = 'INSERT INTO orders () VALUES ()';
        connection.query(sql, [], (error, results) => {
            if (error) {
                console.error('Error adding order:', error);
                res.status(500).send('Error adding order');
            } else {
                console.log('order id', results.insertId);
                // retrieves the auto-generated ID of the newly created order
                const orderId = results.insertId;
                // insert product into the newly created order
                const sql = 'INSERT INTO orderproducts (orderId, productId, quantity) VALUES (?, ?, ?)';
                connection.query(sql, [orderId, productId, quantity], (error, results) => {
                    if (error) {
                        console.error('Error adding product:', error);
                        res.status(500).send('Error adding Product');
                    } else {
                        console.log(results);
                        res.redirect(`cart/${orderId}`);
                    }
                });
            }
        });
    }
});


app.post('/editProduct/:id', (req, res) => {
    const orderProductId = req.params.id;
    const { quantity } = req.body;
    const sql = 'UPDATE orderproducts SET quantity = ? WHERE orderproductId = ?';

    // insert new product into the database
    connection.query(sql, [quantity, orderProductId], (error, results) => {
        if (error) {
            console.error("Error updating order product:", error);
            res.status(500).send('Error updating order product');
        } else {
            if (results.affectedRows > 0) {
                const getOrderSql = 'SELECT orderId FROM orderproducts WHERE orderproductId = ?';
                connection.query(getOrderSql, [orderProductId], (error, results) => {
                    if (error) {
                        console.error("Error retrieving product:", error);
                        res.status(500).send('Error retrieving product');
                    } else {
                        res.redirect(`/cart/${results[0].orderId}`)
                    }
                });
            } else {
                res.status(404).send('Cart not found');
            }
        }
    });
});


app.get('/deleteProduct/:id', (req, res) => {
    const orderproductId = req.params.id;
    const getOrderSql = 'SELECT orderId FROM orderproducts WHERE orderproductId = ?';
    connection.query(getOrderSql, [orderproductId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving product by ID');
        }
        if (results.length > 0) {
            const order = results[0];
            const sql = 'DELETE FROM orderproducts WHERE orderproductId = ?';
            connection.query(sql, [orderproductId], (error, results) => {
                if (error) {
                    console.error("Error deleting product:", error);
                    res.status(500).send('Error deleting product');
                } else {
                    res.redirect(`/cart/${order.orderId}`)
                }
            });
        } else {
            res.status(404).send('Cart not found');
        }
    });


});


app.get('/confirmOrder', (req, res) => {
    res.render('confirmOrder')
})


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);

});




