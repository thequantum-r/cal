"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { useAuth } from "@/contexts/AuthContext";
import { getRestrictedStockDocuments } from "@/lib/actions";
import { AlertCircle, X, ExternalLink, ArrowLeft, FileText } from "lucide-react";
import { normalizeText } from "@/lib/utils";

export default function IssuerRecordsPage() {
  const router = useRouter();
  const params = useParams();
  const issuerId = params?.issuerId;

  const {
    user,
    userRole,
    currentIssuer,
    availableIssuers,
    issuerSpecificRole,
    loading: authLoading,
    initialized,
  } = useAuth();

  const [activeTab, setActiveTab] = useState("depository");
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState(null);
  const [issuerData, setIssuerData] = useState(null);
  const [publicDocuments, setPublicDocuments] = useState([]);
  const [securitiesDocs, setSecuritiesDocs] = useState([]);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [userNotes, setUserNotes] = useState({}); // Map of docId -> note text

  const isBroker = userRole === "broker";
  const isAdmin = userRole === "admin" || userRole === "superadmin";

  // Fetch issuer data and documents
  useEffect(() => {
    const fetchData = async () => {
      if (!initialized || authLoading || !issuerId) return;
      setPageLoading(true);
      setError(null);

      try {
        // Fetch issuer details
        const issuerResponse = await fetch(`/api/issuers/${issuerId}`);
        if (!issuerResponse.ok) throw new Error("Failed to fetch issuer");
        const issuer = await issuerResponse.json();
        setIssuerData(issuer);

        // Fetch public documents for Document Depository
        const docsResponse = await fetch(`/api/issuers/${issuerId}/documents`);
        if (docsResponse.ok) {
          const docsData = await docsResponse.json();
          setPublicDocuments(docsData.documents || []);
        }

        // Fetch securities administration documents
        const securitiesData = await getRestrictedStockDocuments();
        const issuerSecurities = securitiesData.find(
          (item) => item.issuer_id === issuerId || item.issuerId === issuerId || item.id === issuerId
        );
        setSecuritiesDocs(issuerSecurities?.documents || []);

        // Fetch user's personal notes
        const notesResponse = await fetch('/api/records-management/notes');
        if (notesResponse.ok) {
          const notesData = await notesResponse.json();
          // Create a map of docId -> note text for quick lookup
          const notesMap = {};
          notesData.notes.forEach(note => {
            notesMap[note.doc_id] = note.note;
          });
          setUserNotes(notesMap);
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError("Failed to load issuer data. Please try again.");
      } finally {
        setPageLoading(false);
      }
    };

    fetchData();
  }, [initialized, authLoading, issuerId]);

  const saveNote = async (docId, note) => {
    try {
      setError(null);
      const response = await fetch('/api/records-management/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId, note }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save note');
      }

      // Update the local notes map
      setUserNotes(prev => ({
        ...prev,
        [docId]: note
      }));

      setEditingNoteId(null);
      setNoteText("");
    } catch (err) {
      console.error("Save note failed:", err);
      setError(`Failed to save note: ${err.message}`);
    }
  };

  const normalizeStatus = (status) => {
    if (!status || status === "Pending") return "Pending";
    if (status === "Uploaded" || status === "AwaitingVerification") return "Under Review";
    if (status === "Accepted" || status === "Completed") return "Completed";
    return status;
  };

  if (pageLoading) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
        {!isBroker && (
          <Sidebar
            userRole={userRole}
            currentIssuerId={null}
            issuerSpecificRole={issuerSpecificRole}
          />
        )}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            user={user}
            userRole={userRole}
            currentIssuer={currentIssuer}
            availableIssuers={availableIssuers}
            issuerSpecificRole={issuerSpecificRole}
          />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading issuer data...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50">
      {!isBroker && (
        <Sidebar
          userRole={userRole}
          currentIssuerId={null}
          issuerSpecificRole={issuerSpecificRole}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          user={user}
          userRole={userRole}
          currentIssuer={currentIssuer}
          availableIssuers={availableIssuers}
          issuerSpecificRole={issuerSpecificRole}
        />

        <main className="flex-1 overflow-y-auto p-5">
          <div className="max-w-7xl mx-auto px-6">
            {/* Back Button & Header */}
            <div className="mb-6">
              <Button
                variant="ghost"
                onClick={() => router.push('/information')}
                className="mb-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Records Management
              </Button>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                {normalizeText(issuerData?.issuer_name || issuerData?.name) || "Issuer Records"}
              </h1>
              <p className="text-lg text-gray-600">
                View documents, securities administration, and transfer agent requests
              </p>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
                <button onClick={() => setError(null)} className="ml-auto">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Tab Buttons */}
            <div className="mb-6 flex gap-2">
              <Button
                variant={activeTab === "depository" ? "default" : "outline"}
                onClick={() => setActiveTab("depository")}
              >
                Document Depository
              </Button>
              <Button
                variant={activeTab === "securities" ? "default" : "outline"}
                onClick={() => setActiveTab("securities")}
              >
                Securities Administration
              </Button>
              <Button
                variant={activeTab === "transfer" ? "default" : "outline"}
                onClick={() => setActiveTab("transfer")}
              >
                Transfer Agent Requests
              </Button>
            </div>

            {/* Tab Content */}
            <Card>
              <CardContent className="pt-6">
                {/* Tab 1: Document Depository */}
                {activeTab === "depository" && (
                  <div>
                    {publicDocuments.length === 0 ? (
                      <div className="text-center py-12">
                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">No public documents available for this issuer</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Document Type</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Filing Date</TableHead>
                            <TableHead>Link</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {publicDocuments
                            .filter(doc => ['S-1', 'S-1/A', '424B4', '8-K'].includes(doc.type))
                            .map((doc) => (
                              <TableRow key={doc.id}>
                                <TableCell className="font-medium">{doc.type}</TableCell>
                                <TableCell>{doc.title}</TableCell>
                                <TableCell>{doc.filing_date}</TableCell>
                                <TableCell>
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    View <ExternalLink className="w-3 h-3" />
                                  </a>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}

                {/* Tab 2: Securities Administration */}
                {activeTab === "securities" && (
                  <div>
                    {securitiesDocs.length === 0 ? (
                      <div className="text-center py-12">
                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">No documents configured for this issuer</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Required</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {securitiesDocs.map((doc) => {
                            const status = normalizeStatus(doc.submission?.status || doc.status);
                            return (
                              <TableRow key={doc.id}>
                                <TableCell className="font-medium">{doc.document_type || "N/A"}</TableCell>
                                <TableCell>{doc.description || "No description"}</TableCell>
                                <TableCell>{doc.required ? "Yes" : "No"}</TableCell>
                                <TableCell>
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      status === "Completed"
                                        ? "bg-green-100 text-green-800"
                                        : status === "Under Review"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {status}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {editingNoteId === doc.id ? (
                                    <div className="flex gap-2 items-start">
                                      <Textarea
                                        value={noteText}
                                        onChange={(e) => setNoteText(e.target.value)}
                                        className="min-w-[250px]"
                                        placeholder="Add your personal note..."
                                        rows={2}
                                      />
                                      <div className="flex flex-col gap-1">
                                        <Button
                                          size="sm"
                                          onClick={() => saveNote(doc.id, noteText)}
                                        >
                                          Save
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setEditingNoteId(null);
                                            setNoteText("");
                                          }}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div
                                      className="cursor-pointer text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 p-2 rounded"
                                      onClick={() => {
                                        setEditingNoteId(doc.id);
                                        setNoteText(userNotes[doc.id] || "");
                                      }}
                                    >
                                      {userNotes[doc.id] ? (
                                        <span>{userNotes[doc.id]}</span>
                                      ) : (
                                        <span className="text-gray-400 italic">Click to add your note</span>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}

                {/* Tab 3: Transfer Agent Requests */}
                {activeTab === "transfer" && (
                  <div className="py-12 text-center">
                    <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      Transfer Agent Requests Coming Soon
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Brokers will upload documents via DocuSign integration
                    </p>
                    <p className="text-sm text-gray-400 max-w-md mx-auto">
                      Once implemented, brokers will submit documents here which will update the
                      Securities Administration status from "Pending" to "Under Review". Admins can
                      then review and mark as "Completed".
                    </p>
                    {/*
                      FUTURE: DocuSign Integration
                      - Broker uploads document via DocuSign
                      - Status changes: Pending → Under Review
                      - Admin reviews submission
                      - Status changes: Under Review → Completed
                    */}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
