import RoomForm from '@/components/RoomForm';

export default function JoinRoomPage() {
  return (
    <div className="w-full flex flex-col items-center">
      <RoomForm mode="join" />
    </div>
  );
}
