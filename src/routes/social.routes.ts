import express from "express";
import { protect } from "../middleware/auth.middleware";
import {
	sendConnectionRequest,
	respondToConnection,
	getConnections,
	createEndorsement,
	getEndorsements,
	getUserEndorsements,
} from "../controllers/social.controller";

const router = express.Router();

router.use(protect);

// Connection routes
router.route("/connections").get(getConnections).post(sendConnectionRequest);

router.route("/connections/:id/respond").put(respondToConnection);

// Endorsement routes
router.route("/endorsements").get(getEndorsements).post(createEndorsement);

router.route("/endorsements/:userId").get(getUserEndorsements);

export default router;
