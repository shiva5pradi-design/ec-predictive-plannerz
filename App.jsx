import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { format, addHours, startOfHour, eachHourOfInterval } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Zap, AlertTriangle, ShieldCheck, Target, TrendingUp, Gauge, BarChart3, Clock } from 'lucide-react';

// --- SUPABASE CONNECTION ---
// These use the "Environment Variables" you will set in Netlify
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const App = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      const { data: logs, error } = await supabase
        .from('call_logs')
        .select('*');
      
      if (error) {
        console.error("Supabase Error:", error);
      } else {
        setData(logs);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // 2. THE PREDICTIVE ENGINE (Handles your specific CSV dots and status)
  const forecast = useMemo(() => {
    if (data.length === 0) return [];
    
    const historicalMap = {};

    data.forEach(row => {
      const rawDateStr = row["Date Time"];
      if (!rawDateStr) return;
      
      try {
        // --- STEP A: FIX THE DATE DOTS ---
        // Converts "02-Jan-26 01.26.44.180223 AM" -> "02-Jan-26 01:26:44 AM"
        let cleanDate = rawDateStr.replace(/\./g, ':'); 
        const parts = cleanDate.split(':');
        // Remove the microsecond part (.180223) so Javascript can read it
        if (parts.length > 3) {
            const amPm = cleanDate.slice(-3);
            cleanDate = `${parts[0]}:${parts[1]}:${parts[2].split(' ')[0]}${amPm}`;
        }
        
        const d = new Date(cleanDate);
        if (isNaN(d)) return;

        const dayKey = format(d, 'EEE'); // e.g., Mon
        const hourKey = format(d, 'H');   // e.g., 14
        const weekKey = format(d, 'yyyy-ww');
        const key = `${dayKey}-${hourKey}`;

        if (!historicalMap[key]) {
          historicalMap[key] = { total: 0, answered: 0, weeks: new Set() };
        }
        
        historicalMap[key].total++;
        historicalMap[key].weeks.add(weekKey);
        
        // --- STEP B: CHECK SUCCESS STATUS ---
        // Your CSV uses "CALL_COMPLETED"
        const status = row["Call Status"]?.toUpperCase();
        if (status === 'CALL_COMPLETED' || status === 'ANSWERED') {
          historicalMap[key].answered