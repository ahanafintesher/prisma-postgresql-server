import express, { Router } from "express";
import cors from "cors";
import router from "./routes";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/", router)

app.use("/", Router());
app.get("/",(req, res) =>{res.json({
    success: true,
    message: "welcome"
});

});

export default app;