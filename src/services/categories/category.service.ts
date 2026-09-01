import prisma from "../../lib/prisma";

interface CreateCategoryInput {
  name: string;
  slug: string;
}

interface UpdateCategoryInput {
  name?: string;
  slug?: string;
}

// Create Category
export const createCategory = async (data: CreateCategoryInput) => {
  return await prisma.category.create({
    data: {
      name: data.name,
      slug: data.slug,
    },
  });
};

// Get All Categories
export const getAllCategories = async () => {
  return await prisma.category.findMany({
    where: {
      isDeleted: false,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

// Get Single Category
export const getCategoryById = async (id: string) => {
  return await prisma.category.findFirst({
    where: {
      id,
      isDeleted: false,
    },
  });
};

// Update Category
export const updateCategory = async (
  id: string,
  data: UpdateCategoryInput
) => {
  return await prisma.category.update({
    where: {
      id,
    },
    data,
  });
};

// Delete Category (Soft Delete)
export const deleteCategory = async (id: string) => {
  return await prisma.category.update({
    where: {
      id,
    },
    data: {
      isDeleted: true,
    },
  });
};