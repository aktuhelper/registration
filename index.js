const express = require('express');
const mongoose = require('mongoose');
const body_parser = require('body-parser');
const dotenv = require('dotenv');
const path = require('path'); // Import path module
const app = express();

dotenv.config();

const username = encodeURIComponent(process.env.MONGODB_USERNAME);
const pass = encodeURIComponent(process.env.MONGODB_PASSWORD);

const connect = async () => {
    try {
        await mongoose.connect(`mongodb+srv://${username}:${pass}@cluster0.8ihgg.mongodb.net/registration`, {
        });
        console.log("Connected to MongoDB");
    } catch (e) {
        console.log("Error connecting to MongoDB:", e);
    }
};

const regSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String
});

// Model
const Register = mongoose.model("Register", regSchema);

app.use(body_parser.urlencoded({ extended: true }));
app.use(body_parser.json());


const port = process.env.PORT || 3006;




app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'index.html'));
});

app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existing_user = await Register.findOne({ email: email });
        
        if (!existing_user) {
            const regData = new Register({
                name,
                email,
                password
            });
            await regData.save();
            res.redirect("/login");
        } else {
            res.redirect("/error"); // Handle existing user case
        }
    } catch (error) {
        console.log(error);
        res.redirect("/error");
    }
});

app.get("/success", (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'success.html'));
});

app.get("/error", (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'error.html'));
});
app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'login.html'));
});
app.use(express.static(path.join(__dirname, 'home')));

app.get("/home", (req, res) => {
    res.sendFile(path.join(__dirname, 'home', 'home.html'));
});
//login
app.post("/login", async(req,res)=>{
    try{
const email = req.body.email;
const password= req.body.password;
const useremail= await Register.findOne({email:email});
if(useremail.password===password){
    res.redirect("/home");
}else{
    alert("invalid username or password")
}
    }catch(e){
        res.redirect("/error");
    }
})
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

connect();
