import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search as SearchIcon, X, MapPin, Compass, AlertCircle, Sparkles, Clock, Star, Shield, ArrowRight, Heart, Building, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import axios from "axios";
import api from "../../services/api";
import { DoctorCardSkeleton } from "../../components/Skeletons";
import SearchResultCard from "../../components/search/SearchResultCard";
import CarePathwayBanner from "../../components/search/CarePathwayBanner";
import HealthcareDetailView from "../../components/search/HealthcareDetailView";


export default function PatientSearch() {
  const navigate = useNavigate();

  // State variables
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState([]);
  const [searchEventId, setSearchEventId] = useState(null);
  const [mode, setMode] = useState("normal"); // normal, degraded, fallback
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [coords, setCoords] = useState({ lat: null, lng: null });
  const [locating, setLocating] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Progressive Disclosure & Care Pathway States
  const [preference, setPreference] = useState("balanced");
  const [carePathway, setCarePathway] = useState(null);
  const [detailDoctorId, setDetailDoctorId] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const [favorites, setFavorites] = useState([]);
  const [userId, setUserId] = useState("default");
  const [normalizedQuery, setNormalizedQuery] = useState("");

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "clinics" ? "clinics" : "doctors";
  const [clinics, setClinics] = useState([]);
  const [clinicsLoading, setClinicsLoading] = useState(false);

  const fetchClinics = async () => {
    setClinicsLoading(true);
    try {
      const res = await api.get("/hospitals?limit=100");
      if (res.data?.success) {
        const rawData = res.data.data;
        const hospitalsArray = Array.isArray(rawData)
          ? rawData
          : Array.isArray(rawData?.data)
            ? rawData.data
            : [];
        setClinics(hospitalsArray);
      }
    } catch (err) {
      console.error("Failed to load clinics:", err);
    } finally {
      setClinicsLoading(false);
    }
  };

  useEffect(() => {
    fetchClinics();
  }, []);

  // Booking modal states
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingWindowDays, setBookingWindowDays] = useState(7);
  const [confirmingBooking, setConfirmingBooking] = useState(false);

  const fetchSlots = async (docId, dateStr) => {
    if (!docId || !dateStr) return;
    setSlotsLoading(true);
    try {
      const res = await api.get(`/schedule/slots?doctorId=${docId}&date=${dateStr}`);
      if (res.data?.success) {
        setSlots(res.data.data || []);
      } else {
        setSlots([]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load available slots.");
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    if (bookingModalOpen && selectedDoc && selectedDate) {
      fetchSlots(selectedDoc._id, selectedDate);
    }
  }, [bookingModalOpen, selectedDoc, selectedDate]);

  const getBookingDates = (daysLimit) => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < daysLimit; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
      const dayNum = d.getDate();
      dates.push({ dateStr, dayLabel, dayNum });
    }
    return dates;
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    let activeUserId = "default";
    if (token) {
      const parts = token.split(".");
      if (parts.length === 3) {
        try {
          const decoded = JSON.parse(atob(parts[1]));
          activeUserId = decoded.userId || decoded.id || "default";
        } catch (e) {
          console.error(e);
        }
      }
    } else {
      const cachedUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (cachedUser._id || cachedUser.id) {
        activeUserId = cachedUser._id || cachedUser.id;
      }
    }
    setUserId(activeUserId);
    const localKey = `medhospi_favs_${activeUserId}`;
    setFavorites(JSON.parse(localStorage.getItem(localKey) || "[]"));
  }, []);

  const toggleFavorite = (hospitalId, e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!hospitalId) return;
    const localKey = `medhospi_favs_${userId}`;
    let updated;
    if (favorites.includes(hospitalId)) {
      updated = favorites.filter(id => id !== hospitalId);
      toast.success("Removed from saved hospitals.");
    } else {
      updated = [...favorites, hospitalId];
      toast.success("Added to saved hospitals!");
    }
    localStorage.setItem(localKey, JSON.stringify(updated));
    setFavorites(updated);
  };


  const searchInputRef = useRef(null);
  const suggestionRef = useRef(null);
  const searchAbortControllerRef = useRef(null);
  const suggestionsAbortControllerRef = useRef(null);

  // Popular presets for empty state / quick discovery
  const presetSymptoms = [
    { label: "Fever & Cough", icon: "🌡️" },
    { label: "Headache", icon: "🧠" },
    { label: "Stomach Pain", icon: "🤢" },
    { label: "Chest Pain", icon: "❤️" },
    { label: "Joint Pain", icon: "🦴" },
    { label: "Skin Rash", icon: "🧴" }
  ];

  // 1. Session State Persistence - Restore on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get("q");
    if (qParam) {
      setQuery(qParam);
      executeSearchRequest(qParam, false);
      return;
    }

    const savedState = sessionStorage.getItem("patient_search_state");
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setQuery(parsed.query || "");
        setResults(parsed.results || []);
        setSearchEventId(parsed.searchEventId || null);
        setMode(parsed.mode || "normal");
        setNextCursor(parsed.nextCursor || null);
        setHasMore(parsed.hasMore || false);
        setCoords(parsed.coords || { lat: null, lng: null });
        setHasSearched(parsed.hasSearched || false);
        setNormalizedQuery(parsed.normalizedQuery || "");
        setPreference(parsed.preference || "balanced");
        setCarePathway(parsed.carePathway || null);
      } catch (e) {
        console.error("Failed to restore search state", e);
      }
    }
  }, []);

  // Save state on change
  const saveStateToSession = (updatedFields) => {
    const currentState = {
      query,
      results,
      searchEventId,
      mode,
      nextCursor,
      hasMore,
      coords,
      hasSearched,
      normalizedQuery,
      preference,
      carePathway,
      ...updatedFields
    };
    sessionStorage.setItem("patient_search_state", JSON.stringify(currentState));
  };

  // 2. Geolocation Lookup
  const requestLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setCoords(newCoords);
        saveStateToSession({ coords: newCoords });
        setLocating(false);
        toast.success("Location updated! Search results will prioritize nearby doctors.");
        // Re-trigger search if query exists
        if (query.trim().length >= 2) {
          executeSearchRequest(query, false, newCoords);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast.error("Could not fetch location. Using default ranking.");
        setLocating(false);
      },
      { timeout: 10000 }
    );
  };

  const clearLocation = () => {
    const resetCoords = { lat: null, lng: null };
    setCoords(resetCoords);
    saveStateToSession({ coords: resetCoords });
    toast.success("Location filter cleared.");
    if (query.trim().length >= 2) {
      executeSearchRequest(query, false, resetCoords);
    }
  };

  // 3. Debounced query autocomplete suggestions
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      if (suggestionsAbortControllerRef.current) {
        suggestionsAbortControllerRef.current.abort();
      }

      const controller = new AbortController();
      suggestionsAbortControllerRef.current = controller;

      try {
        const res = await api.get(`/search/suggestions?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (res.data?.success) {
          setSuggestions(res.data.data.suggestions || []);
        }
      } catch (err) {
        if (axios.isCancel(err) || err.name === "CanceledError") {
          return;
        }
        // Fail silently to keep user typing uninterrupted
        console.error("Suggestions fetch failed", err);
      }
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // Handle outside click to hide suggestions
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(event.target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle ranking preference change (Balanced / Fastest / Closest)
  const handlePreferenceChange = (newPref) => {
    setPreference(newPref);
    saveStateToSession({ preference: newPref });
    if (query.trim().length >= 2) {
      executeSearchRequest(query, false, coords, newPref);
    }
  };

  // 4. Core Search Execution
  const executeSearchRequest = async (
    searchQuery,
    isLoadMore = false,
    currentCoords = coords,
    currentPreference = preference
  ) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }

    const controller = new AbortController();
    searchAbortControllerRef.current = controller;

    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setHasSearched(true);
    }

    try {
      let url = `/search?q=${encodeURIComponent(trimmed)}&preference=${currentPreference}`;
      if (currentCoords.lat && currentCoords.lng) {
        url += `&lat=${currentCoords.lat}&lng=${currentCoords.lng}`;
      }
      if (isLoadMore && nextCursor) {
        url += `&cursor=${encodeURIComponent(nextCursor)}`;
      }

      const res = await api.get(url, { signal: controller.signal });
      if (res.data?.success) {
        const searchResult = res.data.data;
        const newResults = isLoadMore
          ? [...results, ...searchResult.results]
          : searchResult.results;

        setResults(newResults);
        setSearchEventId(searchResult.searchEventId);
        setMode(searchResult.mode || "normal");
        setNextCursor(searchResult.nextCursor || null);
        setHasMore(searchResult.hasMore || false);
        setNormalizedQuery(searchResult.normalizedQuery || "");
        setCarePathway(searchResult.carePathway || null);
        setShowSuggestions(false);

        saveStateToSession({
          query: trimmed,
          results: newResults,
          searchEventId: searchResult.searchEventId,
          mode: searchResult.mode || "normal",
          nextCursor: searchResult.nextCursor || null,
          hasMore: searchResult.hasMore || false,
          hasSearched: true,
          normalizedQuery: searchResult.normalizedQuery || "",
          preference: currentPreference,
          carePathway: searchResult.carePathway || null
        });

        if (!isLoadMore) {
          if (searchResult.results.length === 0) {
            toast("No doctors matched this search query.", { icon: "🔍" });
          } else {
            toast.success(`Found ${searchResult.results.length} healthcare option${searchResult.results.length === 1 ? "" : "s"}!`);
          }
        }
      }
    } catch (err) {
      if (axios.isCancel(err) || err.name === "CanceledError") {
        return;
      }
      console.error(err);
      toast.error(err.response?.data?.message || "Search failed. Please try again.");
    } finally {
      if (searchAbortControllerRef.current === controller) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  const handleViewDetails = (docId) => {
    setDetailDoctorId(docId);
    setDetailModalOpen(true);
  };

  // 1.5. URL Search Parameters listener
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const qParam = searchParams.get("q");
    if (qParam !== null && qParam.trim() !== "") {
      const queryStr = qParam.trim();
      setQuery(queryStr);
      executeSearchRequest(queryStr, false);
    }
  }, [window.location.search]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (query.trim().length >= 2) {
      executeSearchRequest(query, false);
    } else {
      toast.error("Please enter at least 2 characters to search");
    }
  };

  const selectPresetOrSuggestion = (val) => {
    setQuery(val);
    setShowSuggestions(false);
    executeSearchRequest(val, false);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setSearchEventId(null);
    setMode("normal");
    setNextCursor(null);
    setHasMore(false);
    setHasSearched(false);
    setSuggestions([]);
    saveStateToSession({
      query: "",
      results: [],
      searchEventId: null,
      mode: "normal",
      nextCursor: null,
      hasMore: false,
      hasSearched: false
    });
  };

  // 5. Click & Booking Conversion Actions
  const handleBookDoctor = (doc) => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (!token && !userStr) {
      toast.error("Please login to book an appointment");
      navigate("/login");
      return;
    }

    const hospId = doc.hospitalId?._id || doc.hospitalId || doc.hospital?._id;
    navigate(`/patient/book?doctorId=${doc._id}&hospitalId=${hospId}`);
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot) {
      toast.error("Please select a time slot.");
      return;
    }

    setConfirmingBooking(true);
    const loadingToast = toast.loading("Confirming and booking doctor...");

    try {
      // Step A: Record "click" conversion
      if (searchEventId) {
        await api.post("/search/analytics/action", {
          searchEventId,
          action: "click",
          doctorId: selectedDoc._id
        }).catch(err => console.error("Click logging failed", err));
      }

      // Step B: Submit Book Request
      const bookRes = await api.post("/queue/book", {
        doctorId: selectedDoc._id,
        bookingDate: selectedDate,
        slotTime: selectedSlot
      });
      
      if (bookRes.data?.success) {
        // Step C: Record "book" conversion on success
        if (searchEventId) {
          await api.post("/search/analytics/action", {
            searchEventId,
            action: "book"
          }).catch(err => console.error("Book logging failed", err));
        }

        toast.success("Appointment booked successfully!", { id: loadingToast });
        setBookingModalOpen(false);
        navigate("/patient/queue");
      } else {
        toast.error("Unable to book at this moment.", { id: loadingToast });
      }
    } catch (err) {
      const alternateDoctor = err.response?.data?.data?.alternateDoctor;
      const message = alternateDoctor
        ? `${err.response.data.message} We recommend booking ${alternateDoctor.name} instead.`
        : err.response?.data?.message || "Booking failed";

      toast.error(message, { id: loadingToast });
    } finally {
      setConfirmingBooking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/20 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight flex items-center justify-center gap-2">
            <Sparkles className="w-8 h-8 text-blue-500 animate-pulse" />
            Smart Doctor Search
          </h1>
          <p className="mt-3 text-lg text-slate-600 max-w-2xl mx-auto">
            Describe your symptoms or search doctor names. We'll automatically identify the best department, prioritize availability, and calculate close proximity.
          </p>
        </div>

        {/* Geolocation Controls & Search Bar */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-100 border border-slate-100 p-6 sm:p-8 mb-8">
          
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Location-Aware Mode:</span>
              {coords.lat && coords.lng ? (
                <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                  <MapPin className="w-3.5 h-3.5" />
                  Active ({coords.lat.toFixed(2)}, {coords.lng.toFixed(2)})
                  <button onClick={clearLocation} className="hover:text-red-500 font-bold ml-1 transition" title="Disable location">
                    &times;
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full font-medium">Inactive</span>
              )}
            </div>

            <button
              onClick={requestLocation}
              disabled={locating}
              className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl transition shadow-sm border border-slate-200 active:scale-[0.98] ${
                locating
                  ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                  : "bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-600"
              }`}
            >
              <Compass className={`w-4 h-4 ${locating ? "animate-spin text-blue-500" : ""}`} />
              {locating ? "Locating..." : "Pin My Coordinates"}
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="relative flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <SearchIcon className="h-5.5 w-5.5 text-slate-400" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                className="block w-full pl-12 pr-12 py-4 border border-slate-200 rounded-2xl bg-slate-50/50 text-slate-800 placeholder-slate-400 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-inner"
                placeholder="Describe symptom (e.g. fever, migraine, breathing issue) or doctor..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
              />
              {query && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-2xl transition shadow-md active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 whitespace-nowrap"
            >
              {loading ? "Searching..." : "Search"}
            </button>

            {/* Auto-suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionRef}
                className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-slate-100 shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-50"
              >
                {suggestions.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectPresetOrSuggestion(item)}
                    className="w-full text-left px-5 py-3 hover:bg-slate-50 text-sm text-slate-700 font-medium transition flex items-center gap-2"
                  >
                    <SearchIcon className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    <span>{item}</span>
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>

        {/* Main Content Area */}
        <div className="space-y-6">

          {/* Search Scope Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <button
              onClick={() => setSearchParams({ tab: "doctors" })}
              className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all border-none cursor-pointer ${
                activeTab === "doctors"
                  ? "bg-[#0F4C81] text-white shadow-xs"
                  : "bg-slate-50 border border-slate-100 text-slate-500 hover:bg-slate-100"
              }`}
            >
              Doctors / Specialists
            </button>
            <button
              onClick={() => setSearchParams({ tab: "clinics" })}
              className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all border-none cursor-pointer ${
                activeTab === "clinics"
                  ? "bg-[#0F4C81] text-white shadow-xs"
                  : "bg-slate-50 border border-slate-100 text-slate-500 hover:bg-slate-100"
              }`}
            >
              Partnered Clinics
            </button>
          </div>

          {/* --- DOCTOR SEARCH TAB VIEW --- */}
          {activeTab === "doctors" && (
            <>
              {/* Degraded mode indicators */}
              {hasSearched && mode === "degraded" && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm">Degraded High-Traffic Mode</h4>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Due to high system load or candidate size, we are utilizing high-speed clinical matchmaking. Custom weights are temporarily bypassed.
                    </p>
                  </div>
                </div>
              )}

              {/* Fallback mode indicators */}
              {hasSearched && mode === "fallback" && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm">Failsafe Mode Active</h4>
                    <p className="text-xs text-rose-700 mt-0.5">
                      The matchmaking ranking engine encountered a validation delay. We are serving nearby clinicians via a failsafe route to guarantee uptime.
                    </p>
                  </div>
                </div>
              )}

              {/* Preset symptoms (Show when query is empty and no results exist) */}
              {!hasSearched && (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm text-center">
                  <h3 className="text-base font-bold text-slate-700 mb-5">Popular Symptom Presets</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {presetSymptoms.map((preset, index) => (
                      <button
                        key={index}
                        onClick={() => selectPresetOrSuggestion(preset.label)}
                        className="flex flex-col items-center justify-center p-4 border border-slate-100 rounded-2xl hover:border-blue-200 hover:bg-blue-50/30 transition-all duration-200 group active:scale-[0.97]"
                      >
                        <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">{preset.icon}</span>
                        <span className="text-xs font-semibold text-slate-600 group-hover:text-blue-600">{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Spell check / fuzzy match correction alert */}
              {hasSearched && normalizedQuery && normalizedQuery.toLowerCase() !== query.trim().toLowerCase() && (
                <div className="bg-blue-50/70 backdrop-blur-sm border border-blue-100/60 text-blue-900 rounded-2xl p-4 px-6 flex items-center gap-3 text-left">
                  <Sparkles className="w-5 h-5 text-blue-600 animate-pulse flex-shrink-0" />
                  <div className="text-xs font-semibold">
                    Showing results for <span className="text-blue-950 font-black capitalize">"{normalizedQuery}"</span>
                    <span className="text-slate-400 font-bold mx-1">instead of</span>
                    <span className="text-slate-450 line-through">"{query}"</span>
                  </div>
                </div>
              )}

              {/* Care Pathway & Decision Support Header */}
              {hasSearched && carePathway && (
                <CarePathwayBanner
                  carePathway={carePathway}
                  preference={preference}
                  onSelectPreference={handlePreferenceChange}
                  resultsCount={results.length}
                />
              )}

              {/* Results Header */}
              {hasSearched && (
                <div className="flex items-center justify-between px-2 mb-2">
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">
                    Healthcare Options
                  </h2>
                  <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-3 py-1 rounded-full">
                    {results.length} {results.length === 1 ? "option" : "options"} found
                  </span>
                </div>
              )}

              {/* Results List with Progressive Disclosure */}
              <div className="space-y-6">
                {loading ? (
                  <>
                    <DoctorCardSkeleton />
                    <DoctorCardSkeleton />
                    <DoctorCardSkeleton />
                  </>
                ) : hasSearched && results.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-10 text-center max-w-lg mx-auto">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto text-2xl mb-4 shadow-xs">
                      {mode === "unknown_query" ? "❓" : "🧭"}
                    </div>
                    <h3 className="text-lg font-black text-slate-900">
                      {mode === "unknown_query"
                        ? "Search could not be confidently mapped to a healthcare specialty."
                        : "No Matching Clinicians Available Right Now"}
                    </h3>
                    <p className="text-slate-500 text-xs mt-2 leading-relaxed max-w-md mx-auto">
                      {mode === "unknown_query"
                        ? `We could not recognize "${query}" as a clinical symptom, doctor, specialty, or hospital. Please refine your query using descriptive medical symptoms or provider names.`
                        : `We could not identify active specialists taking walk-in patients for "${query}". You can refine your search or explore common care pathways below.`}
                    </p>

                    <div className="mt-6 pt-5 border-t border-slate-100">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                        Suggested Care Departments
                      </span>
                      <div className="flex flex-wrap justify-center gap-2">
                        {["Fever & Infection", "Headache & Migraine", "Cough & Cold", "Stomach Pain", "Chest Pain"].map((term, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => selectPresetOrSuggestion(term)}
                            className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/60 px-3.5 py-1.5 rounded-xl transition cursor-pointer"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={clearSearch}
                      className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
                    >
                      Clear search and reset
                    </button>
                  </div>
                ) : (
                  <>
                    {/* RECOMMENDED OPTIONS */}
                    {results.filter(r => r.recommended).length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                          <h3 className="text-sm font-extrabold text-blue-950 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                            Recommended Healthcare Options ({results.filter(r => r.recommended).length})
                          </h3>
                          <span className="text-[11px] font-bold text-slate-400">
                            Highest operational alignment
                          </span>
                        </div>

                        <div className="space-y-4">
                          {results.filter(r => r.recommended).map((resultItem) => (
                            <SearchResultCard
                              key={resultItem.doctorId}
                              item={resultItem}
                              isFavorite={favorites.includes(resultItem.hospital?._id || resultItem.doctor?.hospitalId?._id || resultItem.doctor?.hospitalId)}
                              onToggleFavorite={toggleFavorite}
                              onViewDetails={handleViewDetails}
                              onBook={handleBookDoctor}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* OTHER SUITABLE OPTIONS */}
                    {results.filter(r => !r.recommended).length > 0 && (
                      <div className={`space-y-4 ${results.filter(r => r.recommended).length > 0 ? "mt-8 pt-6 border-t border-slate-200/70" : ""}`}>
                        <div className="flex items-center justify-between px-2">
                          <h3 className="text-sm font-extrabold text-slate-700 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-slate-400" />
                            {results.filter(r => r.recommended).length > 0 ? "Other Suitable Options" : "Available Healthcare Options"} ({results.filter(r => !r.recommended).length})
                          </h3>
                          <span className="text-[11px] font-bold text-slate-400">
                            Qualified clinicians in care pathway
                          </span>
                        </div>

                        <div className="space-y-4">
                          {results.filter(r => !r.recommended).map((resultItem) => (
                            <SearchResultCard
                              key={resultItem.doctorId}
                              item={resultItem}
                              isFavorite={favorites.includes(resultItem.hospital?._id || resultItem.doctor?.hospitalId?._id || resultItem.doctor?.hospitalId)}
                              onToggleFavorite={toggleFavorite}
                              onViewDetails={handleViewDetails}
                              onBook={handleBookDoctor}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Load More Button */}
                {hasMore && !loading && (
                  <div className="text-center pt-4">
                    <button
                      onClick={() => executeSearchRequest(query, true)}
                      disabled={loadingMore}
                      className="bg-white hover:bg-slate-50 text-blue-600 font-bold border border-slate-200 px-6 py-3 rounded-2xl transition shadow-sm active:scale-[0.98] text-sm cursor-pointer"
                    >
                      {loadingMore ? "Loading more..." : "Load More Options"}
                    </button>
                  </div>
                )}

              </div>
            </>
          )}

          {/* --- PARTNERED CLINICS TAB VIEW --- */}
          {activeTab === "clinics" && (
            <>
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-bold text-slate-800">
                  Partnered Medical Centers
                </h2>
                <span className="text-xs text-slate-400 font-semibold bg-slate-100 px-3 py-1 rounded-full">
                  Total: {clinics.filter(c => {
                    const term = query.toLowerCase().trim();
                    if (!term) return true;
                    return (
                      c.name?.toLowerCase().includes(term) ||
                      c.address?.toLowerCase().includes(term) ||
                      c.city?.toLowerCase().includes(term) ||
                      (c.specializations && c.specializations.some(s => s.toLowerCase().includes(term)))
                    );
                  }).length}
                </span>
              </div>

              <div className="space-y-4">
                {clinicsLoading ? (
                  <>
                    <DoctorCardSkeleton />
                    <DoctorCardSkeleton />
                  </>
                ) : clinics.filter(c => {
                  const term = query.toLowerCase().trim();
                  if (!term) return true;
                  return (
                    c.name?.toLowerCase().includes(term) ||
                    c.address?.toLowerCase().includes(term) ||
                    c.city?.toLowerCase().includes(term) ||
                    (c.specializations && c.specializations.some(s => s.toLowerCase().includes(term)))
                  );
                }).length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-12 text-center max-w-md mx-auto">
                    <div className="w-16 h-16 bg-slate-50 text-slate-455 rounded-full flex items-center justify-center mx-auto text-2xl mb-4">
                      🏥
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">No clinics found</h3>
                    <p className="text-slate-500 text-sm mt-2">
                      We couldn't find any clinic matching "{query}".
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    {clinics.filter(c => {
                      const term = query.toLowerCase().trim();
                      if (!term) return true;
                      return (
                        c.name?.toLowerCase().includes(term) ||
                        c.address?.toLowerCase().includes(term) ||
                        c.city?.toLowerCase().includes(term) ||
                        (c.specializations && c.specializations.some(s => s.toLowerCase().includes(term)))
                      );
                    }).map((c) => (
                      <div
                        key={c._id || c.id}
                        className="bg-white rounded-3xl border border-slate-200/50 p-6 shadow-sm hover-card-trigger flex flex-col justify-between relative overflow-hidden group"
                      >
                        <div className="absolute top-0 left-0 right-0 h-1 bg-transparent hover:bg-linear-to-r from-[#0F4C81] to-[#14B8A6] transition-all" />
                        <div className="absolute top-4.5 right-4.5 z-10">
                          <button
                            onClick={(e) => toggleFavorite(c._id || c.id, e)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                              favorites.includes(c._id || c.id)
                                ? "bg-rose-50 border-rose-200 text-rose-600"
                                : "bg-slate-50 border-slate-200 text-slate-450 hover:text-slate-700 hover:bg-slate-100"
                            }`}
                            title="Bookmark Hospital"
                          >
                            <Heart className={`h-4.5 w-4.5 ${favorites.includes(c._id || c.id) ? "fill-current" : ""}`} />
                          </button>
                        </div>

                        <div>
                          <div className="w-11 h-11 rounded-xl bg-cyan-50 text-[#0F4C81] flex items-center justify-center mb-4">
                            <Building className="h-5.5 w-5.5" />
                          </div>
                          <h4 className="text-base font-extrabold text-slate-800 tracking-tight leading-snug">{c.name}</h4>
                          <p className="text-xs font-bold text-slate-450 mt-1.5 flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            {c.address?.city || c.city || "Nearby Partner"}
                          </p>
                          
                          {c.address && typeof c.address === "string" && (
                            <p className="text-[11px] font-semibold text-slate-400 mt-2 pl-4.5">
                              {c.address}
                            </p>
                          )}
                          {c.address && typeof c.address === "object" && c.address.street && (
                            <p className="text-[11px] font-semibold text-slate-450 mt-2 pl-4.5 line-clamp-1">
                              {c.address.street}, {c.address.city}
                            </p>
                          )}

                          {c.specializations && c.specializations.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-4">
                              {c.specializations.slice(0, 3).map((spec, sIdx) => (
                                <span key={sIdx} className="bg-slate-50 border border-slate-100 text-slate-600 text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg">
                                  {spec}
                                </span>
                              ))}
                              {c.specializations.length > 3 && (
                                <span className="text-[9px] text-slate-400 font-bold self-center">+{c.specializations.length - 3} more</span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-450">Wait status: online</span>
                          <button
                            onClick={() => navigate(`/patient/book?hospitalId=${c._id || c.id}`)}
                            className="px-5 py-2.5 rounded-xl bg-linear-to-r from-[#14B8A6]/10 to-[#14B8A6]/5 hover:from-[#14B8A6] hover:to-[#0f8b7d] text-[#14B8A6] hover:text-white font-extrabold text-xs transition-all duration-300 cursor-pointer border-none shadow-3xs"
                          >
                            BOOK
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

        </div>

      </div>

      {/* Premium Slot Selection Modal */}
      {bookingModalOpen && selectedDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
              <div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Select Slot & Book</h2>
                <p className="text-xs text-slate-500 mt-0.5">Choose your date and preferred appointment session.</p>
              </div>
              <button
                onClick={() => setBookingModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Doctor Details Summary */}
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 font-extrabold flex items-center justify-center text-sm">
                  {selectedDoc.name?.[0]?.toUpperCase() || "D"}
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm">{selectedDoc.name}</h4>
                  <p className="text-xs text-slate-500">{selectedDoc.specialization} • Avg {selectedDoc.avgConsultationTime || 10} mins</p>
                </div>
              </div>

              {/* Date Selector Scrollbar */}
              <div>
                <h5 className="text-xs font-bold text-slate-600 mb-3 uppercase tracking-wider">Select Date</h5>
                <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none snap-x">
                  {getBookingDates(bookingWindowDays).map((d) => {
                    const isSelected = selectedDate === d.dateStr;
                    return (
                      <button
                        key={d.dateStr}
                        onClick={() => {
                          setSelectedDate(d.dateStr);
                          setSelectedSlot(null);
                        }}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center min-w-[64px] snap-start transition cursor-pointer active:scale-95 ${
                          isSelected
                            ? "bg-blue-650 border-blue-650 text-white shadow-md shadow-blue-100"
                            : "bg-white border-slate-200 text-slate-700 hover:border-slate-350"
                        }`}
                      >
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                          {d.dayLabel}
                        </span>
                        <span className="text-base font-black mt-0.5 leading-none">
                          {d.dayNum}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slots Grid */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Available Slots</h5>
                  <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">
                    IST Timezone
                  </span>
                </div>

                {slotsLoading ? (
                  <div className="grid grid-cols-4 gap-2">
                    {[...Array(8)].map((_, idx) => (
                      <div key={idx} className="h-10 bg-slate-100 animate-pulse rounded-xl border border-slate-50" />
                    ))}
                  </div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50/55 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
                    No operating shifts scheduled for this date.
                  </div>
                ) : slots.length === 1 && ["HOLIDAY", "LEAVE"].includes(slots[0].status) ? (
                  <div className="text-center p-4 bg-rose-50 text-rose-800 rounded-2xl border border-rose-100 text-xs font-semibold">
                    ⚠️ {slots[0].label || `Doctor is unavailable on this date (${slots[0].status})`}
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-[160px] overflow-y-auto pr-1">
                    {slots.map((s) => {
                      const isSelected = selectedSlot === s.time;
                      const isAvailable = s.status === "AVAILABLE";
                      return (
                        <button
                          key={s.time}
                          disabled={!isAvailable}
                          onClick={() => setSelectedSlot(s.time)}
                          className={`h-10 text-xs font-bold rounded-xl border flex items-center justify-center transition cursor-pointer active:scale-95 ${
                            isSelected
                              ? "bg-blue-650 border-blue-650 text-white shadow-sm font-black"
                              : isAvailable
                              ? "bg-white border-slate-200 text-slate-700 hover:border-blue-500 hover:text-blue-600"
                              : "bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed line-through"
                          }`}
                          title={!isAvailable ? `Status: ${s.status}` : `Select slot at ${s.time}`}
                        >
                          {s.time}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
              <div className="text-left">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Selected Time</p>
                <p className="text-slate-800 font-black text-sm mt-0.5">
                  {selectedSlot ? `${selectedSlot} IST` : "None"}
                </p>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setBookingModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmBooking}
                  disabled={confirmingBooking || !selectedSlot}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black text-white transition shadow-sm active:scale-95 ${
                    selectedSlot && !confirmingBooking
                      ? "bg-blue-600 hover:bg-blue-700 cursor-pointer"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {confirmingBooking ? "Booking..." : "Book Appointment"}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* LEVEL 2: PROGRESSIVE DISCLOSURE DETAIL MODAL */}
      {detailModalOpen && detailDoctorId && (
        <HealthcareDetailView
          doctorId={detailDoctorId}
          coords={coords}
          query={query}
          onClose={() => setDetailModalOpen(false)}
          onBook={handleBookDoctor}
          onRequestLocation={requestLocation}
        />
      )}
    </div>
  );
}
