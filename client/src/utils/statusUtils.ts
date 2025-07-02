export const getStatusColor = (status: string): string => {
    switch (status) {
        case "На рассмотрении":
            return "text-yellow-400 bg-yellow-900/50";
        case "В работе":
            return "text-purple-400 bg-purple-900/50";
        case "Выполнена":
            return "text-green-400 bg-green-900/50";
        case "Отклонена":
            return "text-red-400 bg-red-900/50";
        default:
            return "text-gray-400 bg-gray-700/50";
    }
}; 