import { Request, Response } from 'express';
import { ProfileDataService } from '../services/data-section.service';

export const getProfileAnalytics = async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    console.log("profileId here", profileId);

    const service = new ProfileDataService(profileId);
    const data = await service.getProfileData();

    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: (err as Error).message });
  }
};

