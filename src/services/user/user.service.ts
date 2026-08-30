import prisma from "../../lib/prisma";

export const getAllUsers = async () => {
  return await prisma.user.findMany({
    where: {
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

export const getUserById = async (id: string) => {
  return await prisma.user.findMany({
    where: {
      id,
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

export const updateUser = async (
  id: string,
  data: {
    name?: string;
    email?: string;
    role?: "USER" | "ADMIN" | "MANAGER";
  },
) => {
  return await prisma.user.update({
    where: {
      id,
    },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      updatedAt: true,
    },
  });
};

export const deleteUser = async (id: string) => {
  return await prisma.user.update({
    where: {
      id,
    },
    data: {
      isDeleted: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      isDeleted: true,
    },
  });
};