export const formatDate = (dateString: string): string => {
    try {
        const date = new Date(dateString);
        // Проверяем, валидна ли дата
        if (isNaN(date.getTime())) {
            // Возвращаем исходную строку или дефолтное значение, если дата невалидна
            return dateString; 
        }
        return date.toLocaleDateString("ru-RU", { 
            day: "2-digit", 
            month: "2-digit", 
            year: "numeric" 
        });
    } catch (e) {
        // В случае других ошибок возвращаем исходную строку
        console.error("Error formatting date:", e);
        return dateString;
    }
}; 