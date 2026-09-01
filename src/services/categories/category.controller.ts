import { Request, Response } from "express";

import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "./category.service";


export const createCategoryController = async (req: Request, res: Response) => {
    try{ 
        const {name, slug} = req.body;

        if(!name || !slug){
            return res.status(400).json({
        success: false,
        message: "Name and slug are required",
        data: null,
      });
        
    }

    const category = await createCategory({name, slug,})

    return res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: category
    })
 
}

catch (error){
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create category",
      data: null,
    });
}
    
}

export const getCategories = async (req: Request, res: Response) =>{
    try{
        const categories = await getAllCategories();
        return res.status(200).json({
      success: true,
      message: "Categories retrieved successfully",
      data: categories,
    });
    }
    catch (error){
        return res.status(400).json({
            success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to get categories",
      data: null, 
        })
    }
}

export const getCategory = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = req.params.id as string;

    const category = await getCategoryById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category retrieved successfully",
      data: category,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to get category",
      data: null,
    });
  }
};

export const updateCategoryController = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = req.params.id as string;
    const { name, slug } = req.body;

    const existingCategory = await getCategoryById(id);

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
        data: null,
      });
    }

    const updatedCategory = await updateCategory(id, {
      name,
      slug,
    });

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: updatedCategory,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update category",
      data: null,
    });
  }
};

// Soft Delete Category
export const deleteCategoryController = async (
  req: Request,
  res: Response,
) => {
  try {
    const id = req.params.id as string;

    const existingCategory = await getCategoryById(id);

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
        data: null,
      });
    }

    const deletedCategory = await deleteCategory(id);

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
      data: deletedCategory,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to delete category",
      data: null,
    });
  }
};