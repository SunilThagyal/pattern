import RoomForm from '@/components/RoomForm';

export default function CreateRoomPage() {
  return (
    <div className="w-full flex flex-col items-center">
      <RoomForm mode="create" />
    </div>
  );
}
