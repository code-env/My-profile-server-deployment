/* ---------------------------------------------------------------------
   src/controllers/admin-profile-template.controller.ts
   --------------------------------------------------------------------- */

   import { Request, Response, NextFunction } from 'express';
   import createHttpError from 'http-errors';
   import { AdminProfileService,TemplateInput, TemplateUpdate} from '../services/admin-profile-template.service'
   
   const service = new AdminProfileService();
   
   /* helper ──────────────────────────────────────────────────────────── */
   /** Pulls the current admin’s Mongo _id from whatever auth middleware
    *  put it on the request.  Change this if your auth shape is different. */
   const getAdminId = (req: Request) => {
     // e.g. req.user = { _id: '...' } set by a JWT middleware
     const id = (req as any).user?._id;
     if (!id) throw createHttpError(401, 'Admin identity not found on request');
     return id as string;
   };
   
   /* CREATE ──────────────────────────────────────────────────────────── */
   export const createTemplate = async (
     req: Request,
     res: Response,
     next: NextFunction
   ) => {
     try {
       const adminId = getAdminId(req);
       const input = req.body as TemplateInput;
   
       const tpl = await service.createTemplate(adminId, input);
       res.status(201).json(tpl);
     } catch (err) {
       next(err);
     }
   };
   
   /* READ – list all / with filters ──────────────────────────────────── */
   export const listTemplates = async (
     req: Request,
     res: Response,
     next: NextFunction
   ) => {
     try {
       const filter = {
         isActive:
           req.query.isActive !== undefined
             ? req.query.isActive === 'true' // cast from string
             : undefined,
         category: req.query.category as any,
         type: req.query.type as any
       };
       const items = await service.listTemplates(filter);
       res.json(items);
     } catch (err) {
       next(err);
     }
   };
   
   /* READ – by id ────────────────────────────────────────────────────── */
   export const getTemplateById = async (
     req: Request,
     res: Response,
     next: NextFunction
   ) => {
     try {
       const tpl = await service.getTemplateById(req.params.id);
       if (!tpl) throw createHttpError(404, 'Template not found');
       res.json(tpl);
     } catch (err) {
       next(err);
     }
   };
   
   /* UPDATE ──────────────────────────────────────────────────────────── */
   export const updateTemplate = async (
     req: Request,
     res: Response,
     next: NextFunction
   ) => {
     try {
       const adminId = getAdminId(req);
       const updates = req.body as TemplateUpdate;
   
       const tpl = await service.updateTemplate(req.params.id, adminId, updates);
       if (!tpl) throw createHttpError(404, 'Template not found');
       res.json(tpl);
     } catch (err) {
       next(err);
     }
   };
   
   /* DELETE ──────────────────────────────────────────────────────────── */
   export const deleteTemplate = async (
     req: Request,
     res: Response,
     next: NextFunction
   ) => {
     try {
       const success = await service.deleteTemplate(req.params.id);
       if (!success) throw createHttpError(404, 'Template not found');
       res.status(204).end();
     } catch (err) {
       next(err);
     }
   };
   