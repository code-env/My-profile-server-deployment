import { Router } from "express";
import { SettingsController } from "../controllers/settings.controller";
import { SettingsService } from "../services/settings.service";

const router = Router();
const settingsController = new SettingsController();
const settingsService = new SettingsService()


router.post("/", settingsController.createDefault);

router.get("/", settingsController.getSettings);

router.patch("/", settingsController.updateSettings);

router.get("/g/new", settingsController.generatesettings.bind(settingsController));

export default router;
