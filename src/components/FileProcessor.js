import React, { useState } from "react";

const FileProcessor = ({ onProcess, disabled, isProcessing }) => {
  const [selectedFile, setSelectedFile] = useState(null);

  const onPickFile = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
    e.target.value = ""; 
  };

  const handleStartProcessing = () => {
    if (selectedFile) {
      onProcess(selectedFile);
      setSelectedFile(null); // Clear after sending to parent
    }
  };

  return (
    <>
      <div className="or"><div className="line" /><div className="or-text">OR</div><div className="line" /></div>
      
      <label className="transcribe file-btn">
        {selectedFile ? `Ready: ${selectedFile.name}` : "Use Your Own File"}
        <input type="file" accept="audio/*,video/*" onChange={onPickFile} hidden disabled={disabled} />
      </label>
      
      <button 
        className="transcribe" 
        onClick={handleStartProcessing} 
        disabled={!selectedFile || disabled || isProcessing}
      >
        {selectedFile ? `Process: ${selectedFile.name}` : "Process File"}
      </button>
    </>
  );
};

export default React.memo(FileProcessor);