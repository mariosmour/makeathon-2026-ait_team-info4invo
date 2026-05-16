const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentFile) return;

    const userMsg = input;
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      // 1. Convert the attached image file to a Base64 string
      const getBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
        });
      };

      const base64Image = await getBase64(currentFile);

      // 2. Send both the question and the image to the backend
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsg, image: base64Image }),
      });

      const data = await response.json();

      setMessages((prev) => [...prev, { 
        role: 'ai', 
        text: data.answer || data.error || "Κάτι πήγε στραβά." 
      }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'ai', text: "Σφάλμα σύνδεσης." }]);
    } finally {
      setIsLoading(false);
    }
  };