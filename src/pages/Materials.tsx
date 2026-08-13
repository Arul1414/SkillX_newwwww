import React, { useState, useEffect } from 'react';
import { 
  Search, 
  BookOpen, 
  Video, 
  FileText, 
  Link as LinkIcon, 
  Download, 
  ExternalLink,
  ChevronRight,
  Plus,
  Loader2,
  X,
  Eye,
  Check,
  FileCode,
  Copy,
  Sparkles,
  Play
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface MaterialSection {
  title: string;
  body: string;
  code?: string;
}

interface Material {
  id: string;
  title: string;
  type: string;
  url: string;
  uploadedBy: string;
  category: string;
  description?: string;
  timestamp: string;
  videoEmbedId?: string;
  sections?: MaterialSection[];
}

const fallbackMaterials: Material[] = [
  {
    id: "m1",
    title: "System Design Primer & Architecture Cheat Sheet",
    type: "pdf",
    url: "/api/materials/download/m1",
    uploadedBy: "SkillX Admin",
    category: "Engineering",
    description: "Complete guide covering Load Balancers, Microservices, Caching Strategies (Redis), Database Sharding, and Event-Driven Pipelines.",
    timestamp: new Date().toISOString(),
    sections: [
      {
        title: "1. Microservices vs Monolithic Architecture Trade-offs",
        body: "Monoliths excel at early velocity and transactional consistency. Microservices decouple deployments at the cost of distributed tracing (Jaeger/Zipkin), network latency, and eventual consistency.",
        code: `// Express Stateless Gateway Route
app.use('/api/v1/users', async (req, res) => {
  const user = await userService.getUser(req.params.id);
  res.json(user);
});`
      },
      {
        title: "2. Caching Strategies & Redis Invalidation Patterns",
        body: "Cache-Aside pattern is optimal for read-heavy workloads. Check Redis key first; on cache miss, query database, populate Redis with TTL, and return payload."
      },
      {
        title: "3. Database Sharding & Consistent Hashing",
        body: "Distribute write throughput across multiple database instances using horizontal partition keys. Consistent hashing minimizes key re-allocations during node scale-out."
      }
    ]
  },
  {
    id: "m2",
    title: "React 19 & TypeScript Performance Tuning",
    type: "notes",
    url: "/api/materials/download/m2",
    uploadedBy: "Sarah Wilson (Google)",
    category: "Engineering",
    description: "Proven practices for optimizing React component re-renders, useMemo/useCallback memoization, code splitting, and bundle size reduction.",
    timestamp: new Date().toISOString(),
    sections: [
      {
        title: "1. Preventing Unnecessary Component Re-renders",
        body: "React re-renders components when parent props change or state updates. Use React.memo with primitive prop comparisons and keep state localized.",
        code: `// Memoized Component Pattern
const HeavyList = React.memo(({ items }: { items: string[] }) => {
  return (
    <ul>
      {items.map(item => <li key={item}>{item}</li>)}
    </ul>
  );
});`
      },
      {
        title: "2. Code Splitting with React.lazy and Suspense",
        body: "Reduce initial JavaScript bundle footprint by dynamic importing route components using React.lazy and fallback Suspense spinners."
      }
    ]
  },
  {
    id: "m3",
    title: "Product Strategy & Metric Frameworks",
    type: "pdf",
    url: "/api/materials/download/m3",
    uploadedBy: "Michael Chen (Meta)",
    category: "Product",
    description: "Frameworks for answering Product Sense, Execution, and A/B Testing interview questions at top Tier-1 tech companies.",
    timestamp: new Date().toISOString(),
    sections: [
      {
        title: "1. CIRCLES Framework for Product Design",
        body: "Comprehend context, Identify customer, Report user needs, Cut through prioritization, List solutions, Evaluate tradeoffs, Summarize recommendation."
      },
      {
        title: "2. North Star Metric Selection",
        body: "A North Star metric reflects customer value creation, revenue correlation, and long-term retention (e.g. Spotify: Time spent listening to music)."
      }
    ]
  },
  {
    id: "m4",
    title: "Data Structures & Algorithms Cheat Sheet",
    type: "pdf",
    url: "/api/materials/download/m4",
    uploadedBy: "David Kim (Netflix)",
    category: "Engineering",
    description: "Quick reference guide for Big-O time complexity, Binary Search Trees, Dynamic Programming patterns, and Graph Traversals.",
    timestamp: new Date().toISOString(),
    sections: [
      {
        title: "1. Sliding Window & Two-Pointer Pattern",
        body: "Used for optimal O(N) array traversals when identifying maximum/minimum contiguous subarrays or target sum pairs.",
        code: `function twoSumSorted(nums: number[], target: number): number[] {
  let left = 0, right = nums.length - 1;
  while (left < right) {
    const sum = nums[left] + nums[right];
    if (sum === target) return [left, right];
    if (sum < target) left++;
    else right--;
  }
  return [];
}`
      },
      {
        title: "2. BFS vs DFS Graph Traversal Rules",
        body: "BFS (Queue) guarantees shortest path in unweighted graphs. DFS (Stack/Recursion) is optimal for topological sorting and connected components."
      }
    ]
  },
  {
    id: "m5",
    title: "UX Design System & Accessibility Guidelines",
    type: "link",
    url: "https://www.behance.net/",
    uploadedBy: "Elena Rodriguez (Airbnb)",
    category: "Design",
    description: "WCAG 2.1 accessibility checklists, contrast ratios, micro-interactions, and design token naming conventions.",
    timestamp: new Date().toISOString(),
    sections: [
      {
        title: "1. WCAG 2.1 AA Color Contrast Requirements",
        body: "Normal body text requires a contrast ratio of at least 4.5:1 against the background. Large headings (18pt+) require at least 3:1."
      },
      {
        title: "2. Keyboard Navigation & ARIA Roles",
        body: "Ensure all interactive controls have visible focus rings (`focus-visible:ring-2`) and standard keyboard access (Enter/Space)."
      }
    ]
  },
  {
    id: "m6",
    title: "Machine Learning & LLM Fine-Tuning Guide",
    type: "video",
    url: "https://www.youtube.com/watch?v=8hly31xKLI0",
    uploadedBy: "Jessica Lee (Amazon)",
    category: "Data Science",
    description: "Comprehensive crash course on PyTorch, RAG architectures, prompt engineering, and model deployment pipelines.",
    timestamp: new Date().toISOString(),
    videoEmbedId: "8hly31xKLI0",
    sections: [
      {
        title: "1. Retrieval-Augmented Generation (RAG) Architecture",
        body: "Combine vector embeddings (e.g., Pinecone/ChromaDB) with LLM context windows to inject live enterprise database knowledge without retraining."
      },
      {
        title: "2. Quantization & LoRA Fine-Tuning",
        body: "Low-Rank Adaptation (LoRA) updates <1% of model weight matrices during fine-tuning, dramatically reducing GPU RAM requirements."
      }
    ]
  }
];

export default function Materials() {
  const [selectedTab, setSelectedTab] = useState('All');
  const [materials, setMaterials] = useState<Material[]>(fallbackMaterials);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);

  const tabs = ['All', 'pdf', 'notes', 'video', 'link'];

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/materials');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          // Merge fallback rich sections into fetched data if missing
          const enriched = data.map((item: Material) => {
            const fb = fallbackMaterials.find(f => f.id === item.id);
            return {
              ...item,
              sections: item.sections || fb?.sections || [
                {
                  title: "Comprehensive Study Notes & Breakdown",
                  body: item.description || "Detailed notes, architectural concepts, and sample interview questions."
                }
              ],
              videoEmbedId: item.videoEmbedId || fb?.videoEmbedId
            };
          });
          setMaterials(enriched);
        }
      }
    } catch (error) {
      console.warn("Failed to fetch materials, using rich fallback dataset", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    setIsUploading(true);
    try {
      const res = await fetch('/api/materials/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (res.ok) {
        setIsUploadModalOpen(false);
        fetchMaterials();
      }
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  const handleDownloadNotes = (mat: Material) => {
    let content = `# ${mat.title}\nCategory: ${mat.category} | Author: ${mat.uploadedBy}\n\n`;
    content += `## Summary\n${mat.description || ''}\n\n`;
    if (mat.sections) {
      mat.sections.forEach(sec => {
        content += `### ${sec.title}\n${sec.body}\n\n`;
        if (sec.code) {
          content += `\`\`\`\n${sec.code}\n\`\`\`\n\n`;
        }
      });
    }
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mat.title.replace(/[^a-zA-Z0-9]/g, '_')}_Notes.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredMaterials = materials.filter(m => {
    const matchesTab = selectedTab === 'All' || m.type === selectedTab;
    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          m.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Toast */}
      {copiedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-bounce">
          <Check size={16} className="text-emerald-400" />
          Copied to clipboard!
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 font-display">Study Materials & Notes</h1>
          <p className="text-slate-500 text-sm md:text-base">Curated system design guides, cheat sheets, and technical interview notes.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="gradient" className="gap-2 rounded-xl font-bold" onClick={() => setIsUploadModalOpen(true)}>
            <Plus size={18} /> Upload Resource
          </Button>
        </div>
      </div>

      {/* Search & Tabs */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input 
            placeholder="Search resources, topics, or authors..." 
            className="pl-10 h-12 text-sm bg-white border-slate-200" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={cn(
                "px-5 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-wider whitespace-nowrap",
                selectedTab === tab 
                  ? "bg-slate-900 text-white shadow-md" 
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Resource Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
          <p className="text-slate-500 font-medium">Loading resources...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMaterials.map((resource) => (
            <Card key={resource.id} className="group overflow-hidden hover:shadow-xl transition-all duration-300 border-slate-200 rounded-3xl flex flex-col justify-between">
              <div>
                <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6 flex flex-col justify-between text-white">
                  <div className="flex items-center justify-between">
                    <Badge className={cn(
                      "px-3 py-1 text-[10px] font-bold uppercase tracking-wider border-none shadow-md",
                      resource.type === 'video' ? "bg-rose-500 text-white" :
                      resource.type === 'pdf' ? "bg-blue-600 text-white" :
                      resource.type === 'notes' ? "bg-amber-500 text-white" : "bg-emerald-600 text-white"
                    )}>
                      {resource.type}
                    </Badge>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(resource.timestamp).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-center my-2 text-blue-400 group-hover:scale-110 transition-transform">
                    {resource.type === 'video' ? <Video size={44} /> :
                     resource.type === 'pdf' ? <FileText size={44} /> :
                     resource.type === 'notes' ? <FileCode size={44} /> : <LinkIcon size={44} />}
                  </div>

                  <div className="text-left">
                    <span className="text-[10px] font-bold text-blue-300 uppercase tracking-widest block">{resource.category}</span>
                  </div>
                </div>

                <CardContent className="p-6 space-y-3">
                  <h3 className="text-base font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 cursor-pointer" onClick={() => setPreviewMaterial(resource)}>
                    {resource.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    {resource.description || 'Comprehensive resource notes and interview preparation material.'}
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Uploaded by <span className="font-bold text-slate-700">{resource.uploadedBy}</span>
                  </p>
                </CardContent>
              </div>

              <div className="p-6 pt-0 border-t border-slate-100 flex items-center gap-2 mt-4">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1 text-xs font-semibold text-slate-700 gap-1 bg-slate-50 hover:bg-slate-100 border-slate-200"
                  onClick={() => setPreviewMaterial(resource)}
                >
                  <Eye size={14} className="text-blue-600" /> Preview Content
                </Button>

                <Button 
                  size="sm" 
                  variant="gradient" 
                  className="flex-1 text-xs font-bold gap-1"
                  onClick={() => handleDownloadNotes(resource)}
                >
                  <Download size={14} /> Download
                </Button>
              </div>
            </Card>
          ))}

          {filteredMaterials.length === 0 && (
            <div className="col-span-full text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
              <BookOpen className="mx-auto text-slate-300 mb-4" size={48} />
              <h3 className="text-lg font-bold text-slate-900 mb-2">No resources found</h3>
              <p className="text-slate-500 text-xs">Try adjusting your search query or filter tab.</p>
            </div>
          )}
        </div>
      )}

      {/* FULL VISIBLE CONTENT PREVIEW MODAL */}
      <AnimatePresence>
        {previewMaterial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-w-3xl w-full max-h-[90vh] flex flex-col space-y-6 relative border border-slate-200 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-50 text-blue-600 border-none text-[10px] font-bold uppercase tracking-widest">
                      {previewMaterial.category} • {previewMaterial.type}
                    </Badge>
                    <span className="text-xs text-slate-400">By {previewMaterial.uploadedBy}</span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-extrabold text-slate-900 leading-tight">
                    {previewMaterial.title}
                  </h3>
                </div>

                <button 
                  onClick={() => setPreviewMaterial(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors shrink-0"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Content Body */}
              <div className="overflow-y-auto space-y-6 pr-2 flex-1">
                {/* Executive Overview */}
                <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 text-xs text-slate-800 leading-relaxed space-y-2">
                  <h4 className="font-bold text-blue-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={14} className="text-blue-600" /> Executive Overview
                  </h4>
                  <p>{previewMaterial.description || 'Full comprehensive document notes and architectural diagrams.'}</p>
                </div>

                {/* Video Embed Section if applicable */}
                {previewMaterial.type === 'video' && previewMaterial.videoEmbedId && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Play size={16} className="text-rose-500 fill-current" /> Video Course Stream
                    </h4>
                    <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-lg border border-slate-200">
                      <iframe 
                        className="w-full h-full"
                        src={`https://www.youtube-nocookie.com/embed/${previewMaterial.videoEmbedId}?autoplay=1&rel=0`}
                        title={previewMaterial.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}

                {/* Detailed Sections & Code Snippets */}
                <div className="space-y-4 pt-2">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                    <FileText size={16} className="text-blue-600" /> Complete Readable Document Notes
                  </h4>

                  {previewMaterial.sections && previewMaterial.sections.length > 0 ? (
                    previewMaterial.sections.map((sec, idx) => (
                      <div key={idx} className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                        <h5 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          <ChevronRight size={16} className="text-blue-600" /> {sec.title}
                        </h5>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {sec.body}
                        </p>
                        {sec.code && (
                          <div className="relative mt-2">
                            <div className="flex items-center justify-between bg-slate-900 text-slate-300 px-4 py-1.5 rounded-t-xl text-[11px] font-mono">
                              <span>Code / Logic Example</span>
                              <button 
                                onClick={() => handleCopyCode(sec.code!)}
                                className="hover:text-white flex items-center gap-1 transition-colors"
                              >
                                <Copy size={12} /> Copy
                              </button>
                            </div>
                            <pre className="bg-slate-950 text-emerald-400 p-4 rounded-b-xl text-xs font-mono overflow-x-auto leading-relaxed">
                              {sec.code}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed space-y-2">
                      <p>Detailed architectural notes, design patterns, and sample questions for this resource are verified and ready for download.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 gap-3">
                <Button variant="outline" className="rounded-xl text-xs font-bold" onClick={() => setPreviewMaterial(null)}>
                  Close
                </Button>

                <div className="flex items-center gap-2">
                  <Button 
                    variant="gradient" 
                    className="font-bold text-xs gap-2 px-5 rounded-xl"
                    onClick={() => handleDownloadNotes(previewMaterial)}
                  >
                    <Download size={14} /> Download PDF / Notes
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Upload Study Material</h3>
                <button onClick={() => setIsUploadModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">Title</label>
                  <Input name="title" placeholder="e.g. System Design Interview Cheat Sheet" required />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">Category</label>
                  <Input name="category" placeholder="Engineering / Product / Design" required />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">Type</label>
                  <select name="type" className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white" required>
                    <option value="pdf">PDF</option>
                    <option value="notes">Notes</option>
                    <option value="video">Video</option>
                    <option value="link">Link</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">Description</label>
                  <textarea name="description" rows={3} className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none" placeholder="Brief summary..." />
                </div>

                <Button type="submit" variant="gradient" className="w-full font-bold" disabled={isUploading}>
                  {isUploading ? 'Uploading...' : 'Upload Resource'}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
