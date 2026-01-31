import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Upload, FileText, TrendingUp, Plus, X } from 'lucide-react';

export default function ClusterAnalysisTool() {
  const [interpretationData, setInterpretationData] = useState(null);
  const [clusterResults, setClusterResults] = useState(null);
  const [clusterStats, setClusterStats] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [generationSpecs, setGenerationSpecs] = useState({});
  const [selectedApproaches, setSelectedApproaches] = useState({});
  const [trendTokens, setTrendTokens] = useState({});

  const handleFileUpload = (file, type) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (type === 'interpretation') {
          setInterpretationData(results.data);
          calculateClusterStats(results.data);
        } else if (type === 'cluster') {
          setClusterResults(results.data);
        }
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
      }
    });
  };

  const calculateClusterStats = (data) => {
    const clusterGroups = {};
    
    data.forEach(row => {
      const cluster = row.cluster;
      if (!clusterGroups[cluster]) {
        clusterGroups[cluster] = {
          cluster,
          count: 0,
          videos: [],
          motion_values: [],
          cut_rate_values: [],
          audio_rms_mean_values: [],
          audio_rms_std_values: [],
          visual_density_values: []
        };
      }
      
      clusterGroups[cluster].count++;
      clusterGroups[cluster].videos.push(row);
      clusterGroups[cluster].motion_values.push(row.motion_mean || 0);
      clusterGroups[cluster].cut_rate_values.push(row.cut_rate_per_min || 0);
      clusterGroups[cluster].audio_rms_mean_values.push(row.audio_rms_mean || 0);
      clusterGroups[cluster].audio_rms_std_values.push(row.audio_rms_std || 0);
      clusterGroups[cluster].visual_density_values.push(row.visual_density || 0);
    });

    const stats = Object.values(clusterGroups).map(cluster => {
      const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
      const min = (arr) => Math.min(...arr);
      const max = (arr) => Math.max(...arr);
      
      return {
        cluster: cluster.cluster,
        count: cluster.count,
        avg_motion: avg(cluster.motion_values),
        min_motion: min(cluster.motion_values),
        max_motion: max(cluster.motion_values),
        avg_cut_rate: avg(cluster.cut_rate_values),
        min_cut_rate: min(cluster.cut_rate_values),
        max_cut_rate: max(cluster.cut_rate_values),
        avg_audio_rms_mean: avg(cluster.audio_rms_mean_values),
        avg_audio_rms_std: avg(cluster.audio_rms_std_values),
        avg_visual_density: avg(cluster.visual_density_values),
        min_visual_density: min(cluster.visual_density_values),
        max_visual_density: max(cluster.visual_density_values),
        videos: cluster.videos
      };
    });

    setClusterStats(stats.sort((a, b) => a.cluster - b.cluster));
  };

  const getClusterCharacteristics = (stats) => {
    if (!stats) return '';
    
    const characteristics = [];
    
    if (stats.avg_motion > 0.5) characteristics.push('High Motion');
    else if (stats.avg_motion < 0.2) characteristics.push('Low Motion');
    else characteristics.push('Medium Motion');
    
    if (stats.avg_cut_rate > 120) characteristics.push('Fast Cuts');
    else if (stats.avg_cut_rate < 30) characteristics.push('Slow Cuts');
    else characteristics.push('Medium Pacing');
    
    if (stats.avg_visual_density > 0.6) characteristics.push('Visually Dense');
    else if (stats.avg_visual_density < 0.3) characteristics.push('Visually Simple');
    
    if (stats.avg_audio_rms_mean > 0.5) characteristics.push('Loud Audio');
    else if (stats.avg_audio_rms_mean < 0.2) characteristics.push('Quiet Audio');
    
    return characteristics.join(' • ');
  };

  const suggestApproach = (stats) => {
    if (!clusterStats) return 'text-driven';
    
    const radarData = getRadarData(stats);
    const metrics = {
      motion: radarData.find(d => d.metric === 'Motion')?.value || 0,
      cutRate: radarData.find(d => d.metric === 'Cut Rate')?.value || 0,
      visualDensity: radarData.find(d => d.metric === 'Visual Density')?.value || 0,
      audioVolume: radarData.find(d => d.metric === 'Audio Volume')?.value || 0,
      audioVariance: radarData.find(d => d.metric === 'Audio Variance')?.value || 0
    };
    
    // Motion-focused: high motion AND high cut rate (action/dynamic content)
    if (metrics.motion > 60 && metrics.cutRate > 60) {
      return { approach: 'motion-focused', confidence: 'high', reason: 'High motion + fast cuts = movement-driven content' };
    }
    
    // Image-conditioned: high visual density, especially with low motion (strong visual composition)
    if (metrics.visualDensity > 70) {
      return { approach: 'image-conditioned', confidence: 'high', reason: 'Strong visual composition and density' };
    }
    
    if (metrics.visualDensity > 50 && metrics.motion < 40) {
      return { approach: 'image-conditioned', confidence: 'medium', reason: 'Visual-focused with minimal movement' };
    }
    
    // Motion-focused alternative: moderate-high motion even with slower cuts
    if (metrics.motion > 70) {
      return { approach: 'motion-focused', confidence: 'medium', reason: 'Significant camera/subject movement' };
    }
    
    // Text-driven: balanced/moderate across metrics OR unique audio characteristics
    if (metrics.audioVariance > 70 || metrics.audioVolume > 70) {
      return { approach: 'text-driven', confidence: 'medium', reason: 'Distinctive audio characteristics suggest narrative/thematic content' };
    }
    
    // Default: text-driven for balanced clusters
    return { approach: 'text-driven', confidence: 'low', reason: 'Balanced metrics - best suited for conceptual/thematic generation' };
  };

  const handleApproachChange = (cluster, approach) => {
    setSelectedApproaches(prev => ({ ...prev, [cluster]: approach }));
  };

  const handleTrendTokensChange = (cluster, tokens) => {
    setTrendTokens(prev => ({ ...prev, [cluster]: tokens }));
  };

  const addTrendToken = (cluster, token) => {
    if (!token.trim()) return;
    const current = trendTokens[cluster] || [];
    if (current.length >= 3) return; // Max 3 tokens
    if (current.includes(token.trim())) return; // No duplicates
    setTrendTokens(prev => ({
      ...prev,
      [cluster]: [...current, token.trim()]
    }));
  };

  const removeTrendToken = (cluster, index) => {
    const current = trendTokens[cluster] || [];
    setTrendTokens(prev => ({
      ...prev,
      [cluster]: current.filter((_, i) => i !== index)
    }));
  };

  const generateSpec = (cluster) => {
    const stats = clusterStats.find(s => s.cluster === cluster);
    if (!stats) return;

    const approach = selectedApproaches[cluster] || 'text-driven';
    const tokens = trendTokens[cluster] || [];
    
    const spec = {
      cluster_id: cluster,
      generation_approach: approach,
      
      base_prompt_components: {
        visual_style: {
          visual_complexity: stats.avg_visual_density > 0.6 ? 'high' : stats.avg_visual_density > 0.3 ? 'medium' : 'low',
          detail_level: stats.avg_visual_density > 0.5 ? 'detailed' : 'simplified',
          consistency: 'within_cluster_variance'
        },
        
        motion_profile: {
          camera_movement: stats.avg_motion > 0.6 ? 'dynamic' : stats.avg_motion > 0.3 ? 'moderate' : 'static',
          motion_intensity: Math.round(stats.avg_motion * 10),
          motion_range: `${stats.min_motion.toFixed(2)} - ${stats.max_motion.toFixed(2)}`,
          pacing: stats.avg_cut_rate > 120 ? 'fast' : stats.avg_cut_rate > 60 ? 'medium' : 'slow',
          cuts_per_minute: Math.round(stats.avg_cut_rate),
          cut_rate_range: `${Math.round(stats.min_cut_rate)} - ${Math.round(stats.max_cut_rate)}`
        },
        
        audio_profile: {
          volume_level: stats.avg_audio_rms_mean > 0.5 ? 'high' : stats.avg_audio_rms_mean > 0.25 ? 'medium' : 'low',
          dynamic_range: stats.avg_audio_rms_std > 0.3 ? 'high' : stats.avg_audio_rms_std > 0.15 ? 'medium' : 'low',
          audio_rms_mean: stats.avg_audio_rms_mean.toFixed(3),
          audio_rms_std: stats.avg_audio_rms_std.toFixed(3)
        }
      },
      
      trend_tokens: {
        enabled: tokens.length > 0,
        tokens: tokens,
        usage_note: "Optional 1-3 word modifiers appended to base prompt to reflect current trends within cluster",
        application_strategy: "Randomly select 0-2 tokens per generation for variance"
      },
      
      constraints: {
        sample_count: stats.count,
        variation_strategy: approach === 'image-conditioned' ? 'vary_seed_image' : 
                           approach === 'motion-focused' ? 'vary_motion_parameters' : 
                           'vary_text_prompt'
      },
      
      generation_hints: approach === 'image-conditioned' ? {
        note: 'Use representative frames from cluster as seed images. Apply trend tokens to text conditioning.'
      } : approach === 'motion-focused' ? {
        note: 'Emphasize camera movement and subject motion. Trend tokens can guide motion style variations.'
      } : {
        note: 'Focus on thematic and conceptual elements. Trend tokens add current flavor to base themes.'
      }
    };

    setGenerationSpecs(prev => ({ ...prev, [cluster]: spec }));
    setSelectedCluster(cluster);
  };

  const exportSpecs = () => {
    const dataStr = JSON.stringify(generationSpecs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const exportFileDefaultName = 'generation_specs.json';
    
    const linkElement = document.createElement('a');
    linkElement.href = url;
    linkElement.download = exportFileDefaultName;
    document.body.appendChild(linkElement);
    linkElement.click();
    document.body.removeChild(linkElement);
    URL.revokeObjectURL(url);
  };

  const getRadarData = (stats) => {
    if (!clusterStats) return [];
    
    // Get global min/max for each metric across ALL clusters
    const motions = clusterStats.map(s => s.avg_motion);
    const cutRates = clusterStats.map(s => s.avg_cut_rate);
    const densities = clusterStats.map(s => s.avg_visual_density);
    const audioMeans = clusterStats.map(s => s.avg_audio_rms_mean);
    const audioStds = clusterStats.map(s => s.avg_audio_rms_std);
    
    const normalize = (value, values) => {
      const min = Math.min(...values);
      const max = Math.max(...values);
      if (max === min) return 50; // If all same, put in middle
      return ((value - min) / (max - min)) * 100;
    };
    
    return [
      { metric: 'Motion', value: normalize(stats.avg_motion, motions) },
      { metric: 'Cut Rate', value: normalize(stats.avg_cut_rate, cutRates) },
      { metric: 'Visual Density', value: normalize(stats.avg_visual_density, densities) },
      { metric: 'Audio Volume', value: normalize(stats.avg_audio_rms_mean, audioMeans) },
      { metric: 'Audio Variance', value: normalize(stats.avg_audio_rms_std, audioStds) }
    ];
  };

  const getColor = (index) => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
    return colors[index % colors.length];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Video Cluster Analysis & Spec Generator
        </h1>
        <p className="text-slate-400 mb-8">Upload your CSV files to analyze clusters and manually choose generation approaches</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-semibold">Upload interpretation.csv</h2>
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleFileUpload(e.target.files[0], 'interpretation')}
              className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
            />
            {interpretationData && (
              <p className="mt-2 text-sm text-green-400">✓ Loaded {interpretationData.length} videos</p>
            )}
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-purple-400" />
              <h2 className="text-xl font-semibold">Upload cluster_results.csv</h2>
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => handleFileUpload(e.target.files[0], 'cluster')}
              className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-700 file:cursor-pointer"
            />
            {clusterResults && (
              <p className="mt-2 text-sm text-green-400">✓ Loaded {clusterResults.length} cluster assignments</p>
            )}
          </div>
        </div>

        {clusterStats && (
          <>
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 mb-8">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-green-400" />
                Cluster Overview
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={clusterStats}>
                  <XAxis dataKey="cluster" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                    labelStyle={{ color: '#f1f5f9' }}
                  />
                  <Legend />
                  <Bar dataKey="count" fill="#3b82f6" name="Video Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 gap-6 mb-8">
              {clusterStats.map((stats, idx) => (
                <div key={stats.cluster} className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-3xl font-bold" style={{ color: getColor(idx) }}>
                            Cluster {stats.cluster}
                          </h3>
                          <p className="text-sm text-slate-400">{stats.count} videos</p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <p className="text-sm text-slate-300 mb-3">{getClusterCharacteristics(stats)}</p>
                        
                        {(() => {
                          const suggestion = suggestApproach(stats);
                          return (
                            <div className={`mb-4 p-3 rounded-lg border ${
                              suggestion.confidence === 'high' ? 'bg-green-900/20 border-green-700' :
                              suggestion.confidence === 'medium' ? 'bg-blue-900/20 border-blue-700' :
                              'bg-slate-900/20 border-slate-700'
                            }`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-slate-400">SUGGESTED:</span>
                                <span className={`text-sm font-bold ${
                                  suggestion.confidence === 'high' ? 'text-green-400' :
                                  suggestion.confidence === 'medium' ? 'text-blue-400' :
                                  'text-slate-400'
                                }`}>
                                  {suggestion.approach}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  suggestion.confidence === 'high' ? 'bg-green-700 text-green-100' :
                                  suggestion.confidence === 'medium' ? 'bg-blue-700 text-blue-100' :
                                  'bg-slate-700 text-slate-300'
                                }`}>
                                  {suggestion.confidence} confidence
                                </span>
                              </div>
                              <p className="text-xs text-slate-400">{suggestion.reason}</p>
                            </div>
                          );
                        })()}
                        
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Choose Generation Approach:
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {['text-driven', 'image-conditioned', 'motion-focused'].map(approach => (
                              <button
                                key={approach}
                                onClick={() => handleApproachChange(stats.cluster, approach)}
                                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                  selectedApproaches[stats.cluster] === approach
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                {approach}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mb-4">
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Trend Tokens (optional, max 3)
                          </label>
                          <p className="text-xs text-slate-400 mb-2">
                            Add 1-3 short modifiers to reflect current trends (e.g., "vintage filter", "upbeat", "minimalist")
                          </p>
                          <div className="flex gap-2 mb-2">
                            <input
                              type="text"
                              placeholder="Add trend token..."
                              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  addTrendToken(stats.cluster, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                            />
                            <button
                              onClick={(e) => {
                                const container = e.currentTarget.parentElement;
                                const input = container.querySelector('input');
                                addTrendToken(stats.cluster, input.value);
                                input.value = '';
                              }}
                              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          {trendTokens[stats.cluster] && trendTokens[stats.cluster].length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {trendTokens[stats.cluster].map((token, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded-full text-xs font-medium"
                                >
                                  {token}
                                  <button
                                    onClick={() => removeTrendToken(stats.cluster, idx)}
                                    className="hover:bg-purple-700 rounded-full p-0.5"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => generateSpec(stats.cluster)}
                          disabled={!selectedApproaches[stats.cluster]}
                          className={`w-full px-4 py-3 rounded-lg font-medium transition-all ${
                            selectedApproaches[stats.cluster]
                              ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {selectedApproaches[stats.cluster] ? '✓ Generate Spec' : 'Select approach first'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-900 rounded p-3">
                          <p className="text-slate-400 mb-1">Motion</p>
                          <p className="text-xl font-semibold">{stats.avg_motion.toFixed(2)}</p>
                          <p className="text-slate-500 text-xs">{stats.min_motion.toFixed(2)} - {stats.max_motion.toFixed(2)}</p>
                        </div>
                        <div className="bg-slate-900 rounded p-3">
                          <p className="text-slate-400 mb-1">Cut Rate</p>
                          <p className="text-xl font-semibold">{stats.avg_cut_rate.toFixed(1)}/min</p>
                          <p className="text-slate-500 text-xs">{Math.round(stats.min_cut_rate)} - {Math.round(stats.max_cut_rate)}</p>
                        </div>
                        <div className="bg-slate-900 rounded p-3">
                          <p className="text-slate-400 mb-1">Audio RMS</p>
                          <p className="text-xl font-semibold">{stats.avg_audio_rms_mean.toFixed(3)}</p>
                          <p className="text-slate-500 text-xs">±{stats.avg_audio_rms_std.toFixed(3)}</p>
                        </div>
                        <div className="bg-slate-900 rounded p-3">
                          <p className="text-slate-400 mb-1">Visual Density</p>
                          <p className="text-xl font-semibold">{stats.avg_visual_density.toFixed(2)}</p>
                          <p className="text-slate-500 text-xs">{stats.min_visual_density.toFixed(2)} - {stats.max_visual_density.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center">
                      <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={getRadarData(stats)}>
                          <PolarGrid stroke="#475569" />
                          <PolarAngleAxis dataKey="metric" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#94a3b8' }} />
                          <Radar name="Metrics" dataKey="value" stroke={getColor(idx)} fill={getColor(idx)} fillOpacity={0.5} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {Object.keys(generationSpecs).length > 0 && (
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-semibold">Generated Specifications</h2>
                  <button
                    onClick={exportSpecs}
                    className="px-6 py-3 bg-green-600 rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    📥 Export All Specs as JSON
                  </button>
                </div>
                <div className="space-y-4">
                  {Object.entries(generationSpecs).map(([cluster, spec]) => (
                    <div key={cluster} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                      <h3 className="text-lg font-semibold mb-2 text-blue-400">Cluster {cluster}</h3>
                      <pre className="text-xs text-green-400 overflow-x-auto">
                        {JSON.stringify(spec, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!clusterStats && (
          <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
            <Upload className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Upload your CSV files to begin analysis</p>
          </div>
        )}
      </div>
    </div>
  );
}
