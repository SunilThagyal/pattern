"use client"; // Needed for useParams

import RoomForm from '@/components/RoomForm';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function JoinRoomByIdPage() {
  const params = useParams();
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (params.roomId) {
      setRoomId(Array.isArray(params.roomId) ? params.roomId[0] : params.roomId);
    }
  }, [params.roomId]);

  if (!roomId) {
    // Optional: show a loader or a message
    return <div className="text-center p-8">Loading room information...</div>;
  }

  return (
    <div className="w-full flex flex-col items-center">
      <RoomForm mode="join" initialRoomId={roomId} />
    </div>
  );
}
