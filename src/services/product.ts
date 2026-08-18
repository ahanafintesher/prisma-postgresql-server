import { Router } from "express";
import prisma from "../lib/prisma";


const router = Router();

// post a new product

router.post("/products", async(req, res) =>{
    const productData = req.body;
    const data = await prisma.product.create(productData);

    res.json({
        success: true,
        message: "Product created successfully",
        data: data
    })
})