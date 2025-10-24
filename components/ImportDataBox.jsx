"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Settings, FileSpreadsheet, Database } from "lucide-react";
import ImportForm from "./ImportForm";
import SplitRatioManager from "./SplitRatioManager";

export default function ImportDataBox() {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [ratioModalOpen, setRatioModalOpen] = useState(false);

  return (
    <div className="relative overflow-hidden">
      {/* Main Container */}
      <div className="p-6 border border-gray-200 rounded-xl bg-white shadow-lg hover:shadow-xl transition-shadow duration-300">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg">
              <Database className="w-6 h-6 text-white" />
              {/* Split Ratio Modal */}
      {ratioModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Settings className="w-6 h-6" />
                  <div>
                    <h3 className="text-lg font-semibold">Adjust Split Ratios</h3>
                    <p className="text-sm opacity-90">Modify split ratios for existing issuers</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRatioModalOpen(false)}
                  className="text-white hover:bg-white/20 rounded-full w-8 h-8 p-0"
                >
                  ×
                </Button>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <SplitRatioManager onClose={() => setRatioModalOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Data Management</h2>
              <p className="text-sm text-gray-500 mt-1">
                Import Excel data and manage split ratios efficiently
              </p>
            </div>
          </div>
          

        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Import Data Button */}
          <Button
            className="group relative h-14 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            onClick={() => setImportModalOpen(true)}
          >
            <div className="flex items-center space-x-3">
              <div className="p-1 bg-white/20 rounded-md group-hover:bg-white/30 transition-colors">
                <Upload className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Import Data</div>
                <div className="text-xs opacity-90">Excel/XLSX files</div>
              </div>
            </div>
            <FileSpreadsheet className="w-4 h-4 absolute top-2 right-2 opacity-60" />
          </Button>

          {/* Adjust Split Ratios Button */}
          <Button 
            variant="outline" 
            className="group h-14 border-2 border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg"
            onClick={() => setRatioModalOpen(true)}
          >
            <div className="flex items-center space-x-3">
              <div className="p-1 bg-gray-100 rounded-md group-hover:bg-orange-100 transition-colors">
                <Settings className="w-5 h-5 text-gray-600 group-hover:text-orange-600 transition-colors" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">Split Ratios</div>
                <div className="text-xs text-gray-500">Adjust & configure</div>
              </div>
            </div>
          </Button>
        </div>



        {/* Background Pattern */}
        <div className="absolute top-0 right-0 w-32 h-32 opacity-5">
          <div className="w-full h-full bg-gradient-to-br from-orange-500 to-red-500 rounded-full transform rotate-12"></div>
        </div>
      </div>

      {/* Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Upload className="w-6 h-6" />
                  <div>
                    <h3 className="text-lg font-semibold">Import Excel Data</h3>
                    <p className="text-sm opacity-90">Upload and preview your data before saving</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setImportModalOpen(false)}
                  className="text-white hover:bg-white/20 rounded-full w-8 h-8 p-0"
                >
                  ×
                </Button>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <ImportForm onClose={() => setImportModalOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}