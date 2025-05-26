import { Router } from "express";
import { SettingsController } from "../controllers/settings.controller";

const router = Router();
const settingsController = new SettingsController();


router.post("/", settingsController.createDefault);

router.get("/:userId", settingsController.getSettings);

router.patch("/:userId", settingsController.updateSettings);

export default router;
