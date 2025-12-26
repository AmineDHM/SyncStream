import { User } from '../types';
import { Users, Crown, Circle } from 'lucide-react';

interface ParticipantsListProps {
  users: User[];
  hostId: string;
  currentUserId: string;
}

export function ParticipantsList({
  users,
  hostId,
  currentUserId,
}: ParticipantsListProps) {
  return (
    <div className="bg-dark-800 rounded-2xl p-4 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-dark-400" />
        <h3 className="text-white font-medium">
          Participants ({users.length})
        </h3>
      </div>

      <ul className="space-y-2">
        {users.map((user) => (
          <li
            key={user.id}
            className={`flex items-center gap-3 p-2 rounded-xl ${
              user.id === currentUserId
                ? 'bg-dark-700'
                : 'hover:bg-dark-700/50'
            } transition-colors`}
          >
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* Name */}
            <span className="text-white flex-1 truncate">
              {user.name}
              {user.id === currentUserId && (
                <span className="text-dark-400 text-sm ml-2">(You)</span>
              )}
            </span>

            {/* Host indicator */}
            {user.id === hostId && (
              <span title="Host">
                <Crown className="w-4 h-4 text-yellow-500" />
              </span>
            )}

            {/* Online indicator */}
            <Circle className="w-2 h-2 fill-green-500 text-green-500" />
          </li>
        ))}
      </ul>
    </div>
  );
}
