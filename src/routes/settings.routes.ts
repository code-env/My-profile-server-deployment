import { Router } from "express";
import { SettingsController } from "../controllers/settings.controller";
import { SettingsService } from "../services/settings.service";

const router = Router();
const settingsController = new SettingsController();
const settingsService = new SettingsService()


router.post("/", settingsController.createDefault);

router.get("/:pId", settingsController.getSettings);

router.patch("/", settingsController.updateSettings);

router.get("/g/new", settingsController.generatesettings.bind(settingsController));

router.get("/g/profilesettings/all", settingsController.generateProfileSpecificSettingsforAllProfiles.bind(settingsController));

export default router;
