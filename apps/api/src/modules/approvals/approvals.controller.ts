import { Router } from "express";

export const approvalsRouter = Router();

approvalsRouter.post("/", (req, res) => {
  res.status(201).json({
    status: "PENDING",
    payload: req.body ?? {},
    message: "Aprovacao registrada no modulo inicial."
  });
});
