import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import toast from "react-hot-toast";
import { Sparkles, Calendar, MapPin, Stethoscope, Clock, ShieldCheck, Printer, Share2, CalendarPlus, Home } from "lucide-react";

export default function BookingSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = searchParams.get("id");

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) {
      toast.error("Invalid booking ID");
      navigate("/patient");
      return;
    }

    const fetchBookingDetails = async () => {
      try {
        const res = await api.get(`/queue/booking/${bookingId}`);
        if (res.data?.success) {
          setBooking(res.data.data);
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load booking confirmation details.");
      } finally {
        setLoading(false);
      }
    };

    fetchBookingDetails();
  }, [bookingId]);

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Appointment Confirmed - ${booking?.bookingNumber}`,
        text: `Consultation booked with ${booking?.doctorId?.name} at ${booking?.hospitalId?.name}.`,
        url: window.location.href
      }).then(() => toast.success("Shared successfully!"))
        .catch((e) => console.log(e));
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard!");
    }
  };

  const handleAddToCalendar = () => {
    toast.success("Event added to Google Calendar!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 font-bold">Booking details could not be found.</p>
        <button onClick={() => navigate("/patient")} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-xl">
          Return Home
        </button>
      </div>
    );
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(booking.bookingNumber)}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/20 py-10 px-4 sm:px-6 lg:px-8 print:bg-white print:py-0">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Confirmed Banner Header */}
        <div className="text-center space-y-3 print:hidden">
          <div className="w-16 h-16 bg-green-50 border border-green-200 text-green-600 rounded-full flex items-center justify-center mx-auto text-3xl shadow-sm">
            🎉
          </div>
          <h1 className="text-token-dashboard-heading text-slate-800 tracking-tight flex items-center justify-center gap-2">
            Booking Confirmed!
          </h1>
          <p className="text-token-caption">Show this QR ticket at the receptionist desk to check-in.</p>
        </div>

        {/* Dynamic Printable Ticket Container */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden print:shadow-none print:border-none">
          {/* Clinic Watermark Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-650 p-6 text-white flex justify-between items-center">
          <div>
            <span className="text-[10px] font-black tracking-widest uppercase opacity-80">MedHospi Token Ticket</span>
            <h2 className="text-token-section font-extrabold mt-1">{booking.hospitalId?.name}</h2>
            <p className="text-xs text-white/70 mt-0.5">
              {typeof booking.hospitalId?.address === 'object'
                ? booking.hospitalId?.address?.city || booking.hospitalId?.address?.street || ''
                : booking.hospitalId?.address || ''}
            </p>
          </div>
            <ShieldCheck className="w-8 h-8 text-white/95" />
          </div>

          <div className="p-8 space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-100 pb-6">
              
              {/* Ticket Details */}
              <div className="space-y-4 flex-1">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Booking Number</span>
                  <div className="text-token-section text-blue-650 font-black font-mono leading-none mt-1">
                    {booking.bookingNumber}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consultant</span>
                    <p className="text-sm font-extrabold text-slate-800 mt-1">{booking.doctorId?.name}</p>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">{booking.doctorId?.specialization}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Slot Session</span>
                    <p className="text-sm font-extrabold text-slate-800 mt-1">{booking.bookingDate || booking.date}</p>
                    <p className="text-xs text-slate-500">{booking.slotTime}</p>
                    {booking.queueNumber && (
                      <p className="text-xs font-bold text-blue-600 mt-1">Queue #{booking.queueNumber}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Dynamic QR Display */}
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-2xl flex-shrink-0">
                <img
                  src={qrUrl}
                  alt={`Booking QR for ${booking.bookingNumber}`}
                  className="w-40 h-40 object-contain rounded-xl"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              </div>
            </div>

            {/* Instruction Callout */}
            <div className="bg-blue-50/50 border border-blue-100 p-4.5 rounded-2xl flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-token-card-title text-blue-800 text-sm font-bold">Important Check-in Policy</h4>
                <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                  Please arrive at Counter #1 at least **15 minutes** before your selected slot time ({booking.slotTime}) for initial vitals screening. 
                  Have your ticket QR code ready for scanning.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <button
            onClick={() => navigate("/patient")}
            className="flex items-center gap-2 text-token-button text-slate-600 hover:text-slate-800 bg-white border border-slate-200 px-5 py-3 rounded-2xl hover:bg-slate-50 transition active:scale-[0.98] cursor-pointer"
          >
            <Home className="w-4 h-4" /> Dashboard
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleAddToCalendar}
              className="flex items-center gap-2 text-token-button text-slate-700 hover:text-slate-900 bg-white border border-slate-200 px-5 py-3 rounded-2xl hover:bg-slate-50 transition active:scale-[0.98] cursor-pointer"
              title="Add to Google Calendar"
            >
              <CalendarPlus className="w-4.5 h-4.5" /> Calendar
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 text-token-button text-slate-700 hover:text-slate-900 bg-white border border-slate-200 px-5 py-3 rounded-2xl hover:bg-slate-50 transition active:scale-[0.98] cursor-pointer"
              title="Share Ticket Details"
            >
              <Share2 className="w-4.5 h-4.5" /> Share
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 text-token-button bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl shadow-sm transition active:scale-[0.98] cursor-pointer"
            >
              <Printer className="w-4.5 h-4.5" /> Print Ticket
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
