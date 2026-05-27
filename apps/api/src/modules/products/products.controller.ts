import { Router } from "express";

export const productsRouter = Router();

productsRouter.get("/", (_req, res) => {
  res.json({ items: [], message: "Lista inicial de produtos (placeholder)." });
});
