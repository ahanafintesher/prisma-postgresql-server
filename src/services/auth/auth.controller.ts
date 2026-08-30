import { Request, Response } from "express";
import { loginUser, registerUser } from "./auth.service";
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Name, email and password are required",
          data: null,
        });
    }
    const user = await registerUser({ name, email, password });
    return res
      .status(201)
      .json({
        success: true,
        message: "User registered successfully",
        data: user,
      });
  } catch (error) {
    return res
      .status(400)
      .json({
        success: false,
        message: error instanceof Error ? error.message : "Registration failed",
        data: null,
      });
  }
};
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Email and password are required",
          data: null,
        });
    }
    const result = await loginUser({ email, password });
    return res
      .status(200)
      .json({ success: true, message: "Login successful", data: result });
  } catch (error) {
    return res
      .status(400)
      .json({
        success: false,
        message: error instanceof Error ? error.message : "Login failed",
        data: null,
      });
  }
};
