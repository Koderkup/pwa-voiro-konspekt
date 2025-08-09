"use client";
import React, { useEffect, useState } from "react";
import { firestore } from "../../firebase/firebase";
import { Wrap } from "@chakra-ui/react";
import { User } from "../../types/user.dto";
import { deleteDoc, doc } from "firebase/firestore";
import UserCard from "../../components/userCard/userCard";
import FilterUsers from "../../components/filterUsers/FilterUsers";
import { getAllUsers } from "../../utils/getAllUsers";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import Loading from "../../components/Loading/Loading";

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [surnameFilter, setSurnameFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const auth = getAuth();

  const handleUserDeleted = async (userId: string) => {
    try {
      const userRef = doc(firestore, "users", userId);
      await deleteDoc(userRef);
      setUsers(users.filter((user) => user.uid !== userId));
    } catch (error) {
      console.error("Ошибка при удалении пользователя: ", error);
    }
  };

  const filterUsers = () => {
    let filtered = users;
    // Фильтрация по полному имени
    if (surnameFilter) {
      filtered = filtered.filter(
        (user) =>
          user.fullName &&
          user.fullName.toLowerCase().includes(surnameFilter.toLowerCase())
      );
    }

    // Фильтрация по имени пользователя, если фамилия не найдена
    if (filtered.length === 0 && surnameFilter) {
      filtered = users.filter(
        (user) =>
          user.username &&
          user.username.toLowerCase().includes(surnameFilter.toLowerCase())
      );
    }
    // фильтрация по фамилии
    if (filtered.length === 0 && surnameFilter) {
      filtered = users.filter(
        (user) =>
          user.surname &&
          user.surname.toLowerCase().includes(surnameFilter.toLowerCase())
      );
    }
    
    if (dateFilter) {
      const selectedDate = new Date(dateFilter).getTime();
      filtered = filtered.filter((user) => {
        const userDate = user.createdAt;
        return (
          new Date(userDate).toDateString() ===
          new Date(selectedDate).toDateString()
        );
      });
    }

    setFilteredUsers(filtered);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const usersList = await getAllUsers();
        setUsers(usersList);
        setFilteredUsers(usersList);
      } else {
        console.log("Пользователь не авторизован");
        setUsers([]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  if (isLoading) {
    return <Loading />;
  }

  return (
    <>
      <FilterUsers
        surnameFilter={surnameFilter}
        setSurnameFilter={setSurnameFilter}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        onFilter={filterUsers}
      />
      <Wrap my={4} justify="center" align="center">
        {filteredUsers.map((user) => (
          <UserCard
            key={user.uid}
            user={user}
            onUserDeleted={handleUserDeleted}
          />
        ))}
      </Wrap>
    </>
  );
};

export default Users;
