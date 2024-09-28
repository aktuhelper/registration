const dotenv = require('dotenv');
dotenv.config(); 
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();

const username = encodeURIComponent(process.env.MONGODB_USERNAME);
const pass = encodeURIComponent(process.env.MONGODB_PASSWORD);
const secret = process.env.SESSION_SECRET;

// Authorization middleware
const auth = async (req, res, next) => {
    try {
        const token = req.cookies.jwt;
        const verify = jwt.verify(token, process.env.JWT_SECRET);
        req.token = token;
        req.user = verify; // Store verified user data
        next();
    } catch (error) {
        res.status(401).send("Unauthorized: Invalid token");
    }
};

const connect = async () => {
    try {
        await mongoose.connect(`mongodb+srv://${username}:${pass}@cluster0.8ihgg.mongodb.net/registration`, {});
        console.log("Connected to MongoDB");
    } catch (e) {
        console.log("Error connecting to MongoDB:", e);
    }
};

// Registration Schema
const regSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    tokens: [{
        token: {
            type: String,
            required: true
        }
    }]
});

// Hash password before saving
regSchema.pre("save", async function (next) {
    if (this.isModified("password")) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

// Generate authentication token
regSchema.methods.generateAuthToken = async function () {
    try {
        const token = jwt.sign({ _id: this._id.toString() }, process.env.JWT_SECRET);
        this.tokens = this.tokens.concat({ token });
        await this.save();
        return token;
    } catch (error) {
        throw new Error("Error generating token: " + error.message);
    }
};

// Model
const Register = mongoose.model("Register", regSchema);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// Set up session management with MongoDB store
app.use(session({
    secret: secret,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: `mongodb+srv://${username}:${pass}@cluster0.8ihgg.mongodb.net/registration`,
        ttl: 14 * 24 * 60 * 60 // = 14 days
    })
}));


const port = process.env.PORT || 6006;


// Middleware to check authentication
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login'); // Redirect to login if not authenticated
}

// Routes
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'index.html'));
});

app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existing_user = await Register.findOne({ email: email });

        if (!existing_user) {
            const regData = new Register({ name, email, password });
            const token = await regData.generateAuthToken(); // Generate token
            await regData.save();
            res.cookie("jwt", token, { expires: new Date(Date.now() + 120000), httpOnly: true }); // Set cookie
            res.redirect("/login");
        } else {
            res.redirect("/error");
        }
    } catch (error) {
        console.log(error);
        res.redirect("/error");
    }
});

// Getting pages
app.get("/success", (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'success.html'));
});

app.get("/error", (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'error.html'));
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'login.html'));
});

app.get("/product", auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'home', 'product.html'));
});

// Logout logic
app.get("/logout", auth, async (req, res) => {
    try {
        const token = req.cookies.jwt; // Get the token from cookies
        res.clearCookie("jwt"); // Clear the JWT cookie

        // Find the user and remove the token from the tokens array
        const user = await Register.findById(req.user._id); // Fetch user by ID
        if (user) {
            user.tokens = user.tokens.filter(t => t.token !== token); // Remove the token
            await user.save(); // Save the updated user document
        }

        req.session.destroy((err) => {
            if (err) {
                console.log(err);
                return res.send("Error in logout");
            }
            res.redirect("/login"); // Redirect to login after logout
        });
    } catch (error) {
        console.error(error);
        res.send(error);
    }
});

app.use(express.static(path.join(__dirname, 'home')));
app.get("/home", isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'home', 'home.html'));
});

// Login logic
app.post("/login", async (req, res) => {
    try {
        const email = req.body.email;
        const password = req.body.password;
        const useremail = await Register.findOne({ email: email });

        // Check if user exists
        if (!useremail) {
            return res.redirect("/error"); // User not found, redirect to error
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, useremail.password);
        if (isMatch) {
            const token = await useremail.generateAuthToken(); // Generate the token
            res.cookie("jwt", token, { expires: new Date(Date.now() + 120000), httpOnly: true }); // Set the cookie
            req.session.user = useremail; // Store user in session
            res.redirect("/home");
        } else {
            res.redirect("/error"); // Handle invalid login
        }
    } catch (e) {
        console.log(e);
        res.redirect("/error");
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

connect();
