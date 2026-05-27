import { ProductStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../common/prisma";

export const productsRouter = Router();

const productSchema = z.object({
  name: z.string().min(2),
  brand: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  price: z.coerce.number().positive(),
  currency: z.string().default("BRL"),
  cost: z.coerce.number().optional(),
  stockQuantity: z.coerce.number().int().min(0),
  stockLocation: z.string().optional(),
  minMargin: z.coerce.number().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]).optional(),
  imageUrls: z.array(z.string()).optional(),
  videoUrls: z.array(z.string()).optional()
});

const SEED_PRODUCTS = [
  {
    name: "AirPods Pro 2",
    brand: "Apple",
    category: "audio",
    description: "Fones Apple com cancelamento de ruído e case MagSafe.",
    price: 1899,
    cost: 1450,
    stockQuantity: 12
  },
  {
    name: "iPhone 15 128GB",
    brand: "Apple",
    category: "smartphone",
    description: "iPhone 15 lacrado com garantia Apple.",
    price: 4999,
    cost: 4200,
    stockQuantity: 6
  },
  {
    name: "Samsung Galaxy S24",
    brand: "Samsung",
    category: "smartphone",
    description: "Flagship Samsung com AI e câmera avançada.",
    price: 3899,
    cost: 3100,
    stockQuantity: 8
  },
  {
    name: "Xiaomi Redmi Note 13",
    brand: "Xiaomi",
    category: "smartphone",
    description: "Custo-benefício com bateria de longa duração.",
    price: 1299,
    cost: 980,
    stockQuantity: 15
  }
];

productsRouter.get("/", async (_req, res) => {
  const items = await prisma.product.findMany({
    orderBy: { updatedAt: "desc" },
    take: 200
  });
  res.json({ items, total: items.length });
});

productsRouter.post("/seed/default", async (_req, res) => {
  const created = [];
  for (const item of SEED_PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { name: item.name } });
    if (existing) {
      created.push(existing);
      continue;
    }
    const product = await prisma.product.create({
      data: {
        ...item,
        currency: "BRL",
        status: ProductStatus.ACTIVE,
        imageUrls: [],
        videoUrls: []
      }
    });
    created.push(product);
  }
  res.json({ message: "Seed concluído.", items: created });
});

productsRouter.get("/:id", async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) {
    res.status(404).json({ error: "Produto não encontrado." });
    return;
  }
  res.json(product);
});

productsRouter.post("/", async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const product = await prisma.product.create({
    data: {
      ...parsed.data,
      status: (parsed.data.status as ProductStatus) ?? ProductStatus.ACTIVE,
      imageUrls: parsed.data.imageUrls ?? [],
      videoUrls: parsed.data.videoUrls ?? []
    }
  });
  res.status(201).json(product);
});

productsRouter.patch("/:id", async (req, res) => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: parsed.data
  });
  res.json(product);
});
