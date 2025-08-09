import {
  Avatar,
  Button,
  Card,
  HStack,
  Stack,
  Strong,
  Text,
  Tag,
  Input,
  VStack,
} from "@chakra-ui/react";
import { LuCheck, LuX } from "react-icons/lu";
import { User, Workbook } from "../../types/user.dto";
import { FcPlus } from "react-icons/fc";
import { GoTrash } from "react-icons/go";
import { useState } from "react";
import { firestore } from "../../firebase/firebase";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import useShowToast from "../../hooks/useShowToast";
interface UserCardProps {
  user: User;
  onUserDeleted: (userId: string) => Promise<void>;
}
const UserCard: React.FC<UserCardProps> = ({ user, onUserDeleted }) => {
  const { profilePicURL, email, accessibleNotes, fullName, username, surname} = user;
  const [newNote, setNewNote] = useState<Workbook>({ title: "", url: "" });
  const [isInputVisible, setIsInputVisible] = useState(false);
  const showToast = useShowToast();
  const createdAtDate = new Date(user.createdAt).toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const handleAddNote = async () => {
    if (newNote.title.trim() !== "") {
      try {
        const userRef = doc(firestore, "users", user.uid);
        await updateDoc(userRef, {
          accessibleNotes: [...accessibleNotes, newNote],
        });
        setNewNote(newNote);
        setIsInputVisible(false);
        showToast(
          "Success",
          "Заметка успешно добавлена, обновите страницу",
          "success"
        );
      } catch (error) {
        showToast("Error", "Ошибка при добавлении заметки", "error");
        console.error("Ошибка при добавлении заметки: ", error);
      }
    }
  };

  const handleDeleteNote = async (noteToDelete: Workbook) => {
    const updatedNotes = accessibleNotes.filter(
      (note) => note.title !== noteToDelete.title
    );

    try {
      const userRef = doc(firestore, "users", user.uid);
      await updateDoc(userRef, {
        accessibleNotes: updatedNotes,
      });
      showToast(
        "Success",
        "Заметка успешно удалена, обновите страницу",
        "success"
      );
    } catch (error) {
      showToast("Error", "Ошибка при удалении заметки", "error");
      console.error("Ошибка при удалении заметки: ", error);
    }
  };

  return (
    <Card.Root width="320px" h={300} overflowY={'scroll'}>
      <Card.Body>
        <HStack mb="6" gap="3">
          <Avatar.Root>
            <Avatar.Image
              src={profilePicURL || ""}
              // src={profilePicURL || "/images/icons/icon-72x72.png"}
              alt={"Profile picture"}
            />
            <Avatar.Fallback name={fullName ? fullName.charAt(0) : "A"} />
          </Avatar.Root>
          <Stack gap="0">
            <Text fontWeight="semibold" textStyle="sm">
              {surname && surname.trim() !== ""
                ? fullName + " " + surname
                : username}
            </Text>
            <Text color="fg.muted" textStyle="sm">
              Регистрация: {createdAtDate}
            </Text>
            <Text color="fg.muted" textStyle="sm">
              {email}
            </Text>
          </Stack>
        </HStack>
        <Card.Description>
          <Strong color="fg">{fullName || username}</Strong>
          {accessibleNotes.length > 0 ? (
            <Stack>
              {accessibleNotes.map((note, index) => (
                <Tag.Root
                  key={index}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Tag.Label>{note.title}</Tag.Label>
                  <GoTrash
                    style={{ cursor: "pointer", float: "right" }}
                    onClick={() => handleDeleteNote(note)}
                  />
                </Tag.Root>
              ))}
              <FcPlus
                style={{ width: "30px", height: "30px", cursor: "pointer" }}
                onClick={() => setIsInputVisible(!isInputVisible)}
              />
              {isInputVisible && (
                <VStack mt="2">
                  <Input
                    value={newNote.title}
                    onChange={(e) =>
                      setNewNote({ ...newNote, title: e.target.value })
                    }
                    placeholder="Название конспекта"
                  />
                  <Input
                    value={newNote.url}
                    onChange={(e) =>
                      setNewNote({ ...newNote, url: e.target.value })
                    }
                    placeholder="url ссылка на конспекта"
                  />
                </VStack>
              )}
            </Stack>
          ) : (
            <>
              <Text color="fg.muted">Конспектов нет </Text>
              <FcPlus
                style={{ width: "30px", height: "30px", cursor: "pointer" }}
                onClick={() => setIsInputVisible(!isInputVisible)}
              />
              {isInputVisible && (
                <VStack mt="2">
                  <Input
                    value={newNote.title}
                    onChange={(e) =>
                      setNewNote({ ...newNote, title: e.target.value })
                    }
                    placeholder="Название конспекта"
                  />
                  <Input
                    value={newNote.url}
                    onChange={(e) =>
                      setNewNote({ ...newNote, url: e.target.value })
                    }
                    placeholder="url ссылка на конспекта"
                  />
                </VStack>
              )}
            </>
          )}
        </Card.Description>
      </Card.Body>
      <Card.Footer>
        <Button
          variant="subtle"
          colorPalette="red"
          flex="1"
          onClick={() => onUserDeleted(user.uid)}
        >
          <LuX />
          Удалить
        </Button>
        <Button
          variant="subtle"
          colorPalette="blue"
          flex="1"
          onClick={handleAddNote}
        >
          <LuCheck />
          Сохранить
        </Button>
      </Card.Footer>
    </Card.Root>
  );
};

export default UserCard;
