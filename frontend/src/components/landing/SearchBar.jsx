import React from "react";
import { Search, MapPin, Hospital } from "lucide-react";
import Input from "./Input";
import Button from "./Button";

export default function SearchBar({
  symptom,
  setSymptom,
  location,
  setLocation,
  onSearch,
  className = "",
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch({ symptom, location });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`w-full max-w-[700px] bg-white rounded-[20px] p-2 md:p-3 flex flex-col md:flex-row items-center gap-2 md:gap-0 shadow-[0_12_40px_rgba(0,0,0,0.08)] border border-slate-100/50 ${className}`}
    >
      {/* Symptoms Field */}
      <div className="flex-1 w-full flex items-center">
        <Input
          type="text"
          placeholder="Headache, fever, stomach ache..."
          value={symptom}
          onChange={(e) => setSymptom(e.target.value)}
          icon={Search}
          className="border-none focus-within:ring-0"
        />
      </div>

      {/* Divider */}
      <div className="hidden md:block w-[1px] h-10 bg-slate-200 mx-2" />

      {/* Location Field */}
      <div className="flex-1 w-full flex items-center">
        <Input
          type="text"
          placeholder="Patna, Bihar..."
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          icon={MapPin}
          className="border-none focus-within:ring-0"
        />
      </div>

      {/* Search Button */}
      <Button
        type="submit"
        variant="primary"
        className="w-full md:w-auto h-12 md:h-12 px-6 rounded-[16px] gap-2 shrink-0 font-bold bg-[#0E7490] hover:bg-[#0c5f76] text-white flex items-center justify-center transition-all duration-300"
      >
        <Hospital className="h-4 w-4" />
        <span>Search</span>
      </Button>
    </form>
  );
}
