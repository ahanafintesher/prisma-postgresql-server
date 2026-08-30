import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";

import {
  getUsers,
  getUser,
  updateUserController,
  deleteUserController,
} from "./user.controller";

const router = Router();

router.get("/", authenticate, getUsers);
router.get("/:id", authenticate, getUser);
router.patch("/:id", authenticate, updateUserController);
router.delete("/:id", authenticate, deleteUserController);

export default router;