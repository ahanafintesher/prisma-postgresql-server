import express, { Router } from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());


app.use("/", Router());
app.get("/",(req, res) =>{res.json({
    success: true,
    message: "welcome"
});

});

export default app;