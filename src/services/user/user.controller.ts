import { Request, Response } from "express";

export const getProfile = async (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    message: "Profile retrieved successfully",
    data: req.user,
  });
};
