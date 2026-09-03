import prisma from "../../lib/prisma";

interface CreateProductInput {
  title: string;
  description: string;
  price: number;
  stock: number;
  categoryId: string;
  sellerId: string;
  status?: "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK";
}
interface UpdateProductInput {
  title: string;
  description: string;
  price: number;
  stock: number;
  categoryId: string;
  status?: "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK";
}

const createProduct = async (data: CreateProductInput) => {
  const category = await prisma.category.findFirst({
    where: {
      id: data.categoryId,
      isDeleted: false,
    },
  });

  if (!category) {
    throw new Error("Category not Found");
  }

  const seller = await prisma.user.findFirst({
    where: {
      id: data.sellerId,
      isDeleted: false,
    },
  });

  if (!seller) {
    throw new Error("Seller not Found");
  }


  const product = await prisma.product.create({
    data,
    include: {
      category: true,
      seller: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return product;
};


const getAllProducts = async () =>{
  const products = await prisma.product.findMany({
    where:{
      isDeleted: false,
    },
    include:{
      category: true,
      seller:{
        select:{
          id: true,
          name: true,
          email: true,
        }
      }
    },
    orderBy:{
      createdAt: "desc"
    }
  })
  return products;
}


const getProductById = async (id: string) => {
  const product = await prisma.product.findFirst({
    where:{
      id,
      isDeleted: false,
    },include:{
      category: true,
      seller:{
        select: {
          id: true,
          name: true,
          email: true,
        }
      }
    }
  })
  if (!product) {
    throw new Error("Product not found");
  }
  return product;
}

const updateProduct = async(id: string, data: UpdateProductInput) =>{
  const existingProduct = await prisma.product.findFirst({
    where:{
      id,
      isDeleted: false,
    }
  })

  if(!existingProduct){
    throw new Error("Product not found");
  }

  if(data.categoryId){
    const category = await prisma.category.findFirst({
      where:{
        id: data.categoryId,
        isDeleted: false,
      }
    })

    if (!category) {
      throw new Error("Category not found");
    }
  }
  
  const product = await prisma.product.update({
    where:{
      id,
    },
    data,
    include:{
      category: true,
      seller:{
        select:{
          id: true,
          name: true,
          email: true,
        }
      }
    }
  })
  return product;
}

const deleteProduct = async (id: string) => {
  const existingProduct = await prisma.product.findFirst({
    where: {
      id,
      isDeleted: false,
    },
  });

  if (!existingProduct) {
    throw new Error("Product not found");
  }

  const product = await prisma.product.update({
    where: {
      id,
    },
    data: {
      isDeleted: true,
    },
  });

  return product;
};

export const productService = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};