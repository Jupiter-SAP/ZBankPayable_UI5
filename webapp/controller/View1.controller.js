sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/thirdparty/jquery"
], (Controller, JSONModel, MessageToast, jQuery) => {
    "use strict";

    return Controller.extend("zzbankpayable.controller.View1", {

        onInit() {
            // Local model for preview
            this.getView().setModel(new JSONModel([]), "UploadModel");
            this.byId("stBankPayable").attachInitialise(() => {
                const oTable = this.byId("stBankPayable").getTable();
                if (oTable.setMode) {
                    oTable.setMode("MultiSelect");
                }

            });

            this.oModel = new sap.ui.model.json.JSONModel({
                printEnable: false,
                reprintEnable: false,
                approveEnable : true,
                holdEnable : true,
                rejectEnable : true
            });

            this.getView().setModel(this.oModel, "ViewModel");

        },

        // onSelectionChange: function () {

        //     const oSmartTable = this.byId("stBankPayable");
        //     const oTable = oSmartTable.getTable();

        //     var aSelectedItems = oTable.getSelectedIndices().map(function (iIndex) {
        //         var oContext = oTable.getContextByIndex(iIndex);
        //         if (!oContext) return null;

        //         var row = oContext.getObject();

        //         return {
        //             Accountingdocument: row.Accountingdocument || "",
        //             Fiscalyear: row.Fiscalyear || "",
        //             Companycode: row.Companycode || "",
        //             Isapproved: row.Isapproved || ""
        //         };
        //     }).filter(Boolean);

        //     var bEnable = false;

        //     if (aSelectedItems.length > 0 && aSelectedItems[0].Isapproved === "Printed") {
        //         bEnable = true;
        //     }

        //     this.getView().getModel("ViewModel").setProperty("/enable", bEnable);

        // },

        onSelectionChange: function () {
            const oSmartTable = this.byId("stBankPayable");
            const oTable = oSmartTable.getTable();

            var aSelectedItems = oTable.getSelectedIndices().map(function (iIndex) {
                var oContext = oTable.getContextByIndex(iIndex);
                return oContext ? oContext.getObject() : null;
            }).filter(Boolean);

            let printEnable = false;
            let reprintEnable = false;
            let approveEnable = true;
            let holdEnable = true;
            let rejectEnable = true;

            if (aSelectedItems.length > 0) {
                const status = aSelectedItems[0].Isapproved;

                if ( status === "Approved") {
                    // First time → Print active
                    printEnable = true;
                    holdEnable = false;
                    rejectEnable = false;
                }
                else if (status === "Printed" || status === "Reprinted") {
                    // Already printed → Reprint active
                    reprintEnable = true;
                    approveEnable = false;
                    holdEnable = false;
                    rejectEnable = false;                    
                }

                // else if(status === "Rejected"){
                //     approveEnable = false;
                //     holdEnable = false;
                // }
            }

            const oVM = this.getView().getModel("ViewModel");

            oVM.setProperty("/printEnable", printEnable);
            oVM.setProperty("/reprintEnable", reprintEnable);
            oVM.setProperty("/approveEnable", approveEnable);
            oVM.setProperty("/holdEnable", holdEnable);
            oVM.setProperty("/rejectEnable", rejectEnable);

        },


        onFileChange(oEvent) {
            var oFileUploader = oEvent.getSource();
            this._file = oFileUploader.oFileUpload.files[0];
            if (this._file) {
                MessageToast.show("File selected: " + this._file.name);
            }
        },

        onPrint: function () {

            const oSmartTable = this.byId("stBankPayable");
            const oTable = oSmartTable.getTable();

            var aSelectedItems = oTable.getSelectedIndices().map(function (iIndex) {
                var oContext = oTable.getContextByIndex(iIndex);
                if (!oContext) return null;

                var row = oContext.getObject();

                return {
                    Accountingdocument: row.Accountingdocument || "",
                    Fiscalyear: row.Fiscalyear || "",
                    Companycode: row.Companycode || "",
                    isApproved: row.Isapproved || ""
                };
            }).filter(Boolean);

            if (!aSelectedItems || aSelectedItems.length === 0) {
                sap.m.MessageToast.show("Please select at least one row to approve.");
                return;
            }

            var oBusyDialog = new sap.m.BusyDialog({
                title: "Please Wait...",
                text: "Fetching Data"
            });
            oBusyDialog.open();

            let doc = "";
            let document = "";


            for (let i = 0; i < aSelectedItems.length; i++) {
                doc = aSelectedItems[i].Accountingdocument;

                if (aSelectedItems[i].isApproved === '') {
                    sap.m.MessageBox.error(doc + " is not approved");
                    oBusyDialog.close();
                    return;
                }

                if (aSelectedItems[i].isApproved === 'Printed' || aSelectedItems[i].isApproved === 'Reprinted') {
                    sap.m.MessageBox.error(doc + " is already printed");
                    oBusyDialog.close();
                    return;
                }

                if (i === aSelectedItems.length - 1) {
                    document = document + doc;
                }
                else {
                    document = document + doc + ",";
                }
            }

            let companyCode = aSelectedItems[0].Companycode;
            let fiscalYear = aSelectedItems[0].Fiscalyear;
            let status = aSelectedItems[0].isApproved;

            var url1 = "/sap/bc/http/sap/ZHTTP_CRYSTAL_REPORT_NEW?";
            var url2 = "&companycode=" + companyCode;
            var url3 = "&documentno=" + document;
            var url4 = "&fiscalyear=" + fiscalYear;
            var url5 = "&status=" + status;

            var url = url1 + url2 + url3 + url4 + url5;
            $.ajax({
                url: url,
                type: "GET",
                beforeSend: function (xhr) {
                    xhr.withCredentials = true;
                },
                success: function (result) {
                    if (result.includes("Timeout") || result.includes("error") || result.includes("Error in generating crystal report")) {
                        MessageToast.show(result);
                        oBusyDialog.close();
                        return;
                    }

                    oSmartTable.rebindTable();

                    var decodedPdfContent = atob(result);
                    var byteArray = new Uint8Array(decodedPdfContent.length);
                    for (var i = 0; i < decodedPdfContent.length; i++) {
                        byteArray[i] = decodedPdfContent.charCodeAt(i);
                    }
                    var blob = new Blob([byteArray.buffer], { type: 'application/pdf' });
                    var _pdfurl = URL.createObjectURL(blob);
                    oSmartTable.rebindTable();
                    if (!this._PDFViewer) {
                        this._PDFViewer = new sap.m.PDFViewer({
                            width: "auto",
                            source: _pdfurl
                        });
                        jQuery.sap.addUrlWhitelist("blob");
                    } else {
                        this._PDFViewer.setSource(_pdfurl);
                    }
                    const oVM = this.getView().getModel("ViewModel");
                    oVM.setProperty("/printEnable", false);
                    oVM.setProperty("/reprintEnable", true);
                    oBusyDialog.close();
                    this._PDFViewer.open();

                }.bind(this),
                error: function () {
                    sap.m.MessageBox.show("Something went wrong");
                    oBusyDialog.close();
                }
            });

        },

        onReprint: function () {

            const oSmartTable = this.byId("stBankPayable");
            const oTable = oSmartTable.getTable();

            var aSelectedItems = oTable.getSelectedIndices().map(function (iIndex) {
                var oContext = oTable.getContextByIndex(iIndex);
                if (!oContext) return null;

                var row = oContext.getObject();

                return {
                    Accountingdocument: row.Accountingdocument || "",
                    Fiscalyear: row.Fiscalyear || "",
                    Companycode: row.Companycode || "",
                    isApproved: row.Isapproved || "",
                };
            }).filter(Boolean);

            if (!aSelectedItems || aSelectedItems.length === 0) {
                sap.m.MessageToast.show("Please select at least one row to approve.");
                return;
            }

            var oBusyDialog = new sap.m.BusyDialog({
                title: "Please Wait...",
                text: "Fetching Data"
            });
            oBusyDialog.open();

            let doc = "";
            let document = "";

            for (let i = 0; i < aSelectedItems.length; i++) {
                doc = aSelectedItems[i].Accountingdocument;

                if (aSelectedItems[i].isApproved === '') {
                    sap.m.MessageBox.error(doc + " is not approved");
                    oBusyDialog.close();
                    return;
                }

                if (aSelectedItems[i].isApproved === 'Approved') {
                    sap.m.MessageBox.error(doc + " is not already printed");
                    oBusyDialog.close();
                    return;
                }

                if (i === aSelectedItems.length - 1) {
                    document = document + doc;
                }
                else {
                    document = document + doc + ",";
                }
            }

            let companyCode = aSelectedItems[0].Companycode;
            let fiscalYear = aSelectedItems[0].Fiscalyear;
            let status = aSelectedItems[0].isApproved;

            var url1 = "/sap/bc/http/sap/ZHTTP_CRYSTAL_REPORT_NEW?";
            var url2 = "&companycode=" + companyCode;
            var url3 = "&documentno=" + document;
            var url4 = "&fiscalyear=" + fiscalYear;
            var url5 = "&status=" + status;

            var url = url1 + url2 + url3 + url4 + url5;
            $.ajax({
                url: url,
                type: "GET",
                beforeSend: function (xhr) {
                    xhr.withCredentials = true;
                },
                success: function (result) {
                    if (result.includes("Timeout") || result.includes("error") || result.includes("Error in generating crystal report")) {
                        MessageToast.show(result);
                        oBusyDialog.close();
                        return;
                    }
                    oSmartTable.rebindTable();
                    var decodedPdfContent = atob(result);
                    var byteArray = new Uint8Array(decodedPdfContent.length);
                    for (var i = 0; i < decodedPdfContent.length; i++) {
                        byteArray[i] = decodedPdfContent.charCodeAt(i);
                    }
                    var blob = new Blob([byteArray.buffer], { type: 'application/pdf' });
                    var _pdfurl = URL.createObjectURL(blob);
                    oSmartTable.rebindTable();
                    if (!this._PDFViewer) {
                        this._PDFViewer = new sap.m.PDFViewer({
                            width: "auto",
                            source: _pdfurl
                        });
                        jQuery.sap.addUrlWhitelist("blob");
                    } else {
                        this._PDFViewer.setSource(_pdfurl);
                    }

                    const oVM = this.getView().getModel("ViewModel");
                    oVM.setProperty("/printEnable", false);
                    oVM.setProperty("/reprintEnable", true);

                    oBusyDialog.close();
                    this._PDFViewer.open();


                }.bind(this),
                error: function () {
                    sap.m.MessageBox.show("Something went wrong");
                    oBusyDialog.close();
                }
            });

        },

        // formatStatusState: function (status) {
        //     switch (status) {
        //         case "Approved":
        //             return "Success";
        //         case "Printed":
        //             return "Information";
        //         case "Reprinted":
        //             return "Information";
        //         default:
        //             return "Error";
        //     }
        // },
        // formatStatusIcon: function (status) {
        //     switch (status) {
        //         case "Approved":
        //             return "sap-icon://sys-enter-2";
        //         case "Printed":
        //             return "sap-icon://document";
        //         case "Reprinted":
        //             return "sap-icon://document-text";
        //         default:
        //             return "sap-icon://error";
        //     }
        // },

        onBeforeExport: function (oEvent) {
            const oSmartTable = this.byId("stBankPayable");
            const oTable = oSmartTable.getTable();
            let aSelectedItems = [];

            // ResponsiveTable selection
            if (oTable.getSelectedItems) {
                aSelectedItems = oTable.getSelectedItems();
            }
            // GridTable / AnalyticalTable selection
            else if (oTable.getSelectedIndices) {
                aSelectedItems = oTable.getSelectedIndices().map(idx => oTable.getContextByIndex(idx));
            }
            if (aSelectedItems && aSelectedItems.length > 0) {
                const selectedData = aSelectedItems.map(item => {
                    const ctx = item.getBindingContext ? item.getBindingContext() : item;
                    return ctx.getObject();
                });

                // Override the export dataset
                oEvent.getParameter("exportSettings").dataSource = {
                    type: "array",
                    data: selectedData
                };
            }
        },

        onApprove: function () {
            const oSmartTable = this.byId("stBankPayable");
            const oTable = oSmartTable.getTable();

            var aSelectedItems = oTable.getSelectedIndices().map(function (iIndex) {
                var oContext = oTable.getContextByIndex(iIndex);
                if (!oContext) return null;

                var row = oContext.getObject();
                return {
                    Accountingdocument: row.Accountingdocument || "",
                    Fiscalyear: row.Fiscalyear || "",
                    Companycode: row.Companycode || "",
                };
            }).filter(Boolean);

            if (!aSelectedItems || aSelectedItems.length === 0) {
                sap.m.MessageToast.show("Please select at least one row to approve.");
                return;
            }

            $.ajax({
                url: "/sap/bc/http/sap/ZHTTP_BANK_PAYABLE",
                method: "PUT",
                data: JSON.stringify(aSelectedItems),
                success: function (response) {
                    if (response.includes("Already")) {
                        sap.m.MessageBox.error(response)
                    }
                    else {
                        sap.m.MessageToast.show(response);
                        oSmartTable.rebindTable();
                    }

                },
                error: function (error) {
                    sap.m.MessageToast.show("Error in approval", error);
                    oSmartTable.rebindTable();
                }
            });
        },

        onReject: function () {
            const oSmartTable = this.byId("stBankPayable");
            const oTable = oSmartTable.getTable();

            var aSelectedItems = oTable.getSelectedIndices().map(function (iIndex) {
                var oContext = oTable.getContextByIndex(iIndex);
                if (!oContext) return null;

                var row = oContext.getObject();
                return {
                    Accountingdocument: row.Accountingdocument || "",
                    Fiscalyear: row.Fiscalyear || "",
                    Companycode: row.Companycode || "",
                };
            }).filter(Boolean);

            if (!aSelectedItems || aSelectedItems.length === 0) {
                sap.m.MessageToast.show("Please select at least one row to reject.");
                return;
            }

            $.ajax({
                url: "/sap/bc/http/sap/ZHTTP_REJECT_HOLD",
                method: "PUT",
                data: JSON.stringify(aSelectedItems),
                success: function (response) {
                    if (response.includes("Already")) {
                        sap.m.MessageBox.error(response)
                    }
                    else {
                        sap.m.MessageToast.show(response);
                        oSmartTable.rebindTable();
                    }

                },
                error: function (error) {
                    sap.m.MessageToast.show("Error in reject", error);
                    oSmartTable.rebindTable();
                }
            });
        },

        onHold: function () {
            const oSmartTable = this.byId("stBankPayable");
            const oTable = oSmartTable.getTable();

            var aSelectedItems = oTable.getSelectedIndices().map(function (iIndex) {
                var oContext = oTable.getContextByIndex(iIndex);
                if (!oContext) return null;

                var row = oContext.getObject();
                return {
                    Accountingdocument: row.Accountingdocument || "",
                    Fiscalyear: row.Fiscalyear || "",
                    Companycode: row.Companycode || "",
                };
            }).filter(Boolean);

            if (!aSelectedItems || aSelectedItems.length === 0) {
                sap.m.MessageToast.show("Please select at least one row to hold.");
                return;
            }

            $.ajax({
                url: "/sap/bc/http/sap/ZHTTP_REJECT_HOLD",
                method: "POST",
                data: JSON.stringify(aSelectedItems),
                success: function (response) {
                    if (response.includes("Already")) {
                        sap.m.MessageBox.error(response)
                    }
                    else {
                        sap.m.MessageToast.show(response);
                        oSmartTable.rebindTable();
                    }

                },
                error: function (error) {
                    sap.m.MessageToast.show("Error in hold", error);
                    oSmartTable.rebindTable();
                }
            });
        },


        onUploadPress() {
            if (!this._file) {
                MessageToast.show("Please select a file first!");
                return;
            }
            var that = this;
            var reader = new FileReader();

            reader.onload = function (e) {
                try {
                    var data = new Uint8Array(e.target.result);
                    var workbook = XLSX.read(data, { type: 'array' });

                    var sheetName = workbook.SheetNames[0];
                    var worksheet = workbook.Sheets[sheetName];

                    var aData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                    if (!aData.length) {
                        MessageToast.show("Excel file is empty!");
                        return;
                    }

                    // Map headers
                    var headerMap = {
                        "Accounting Document": "Accountingdocument",
                        "Company Code": "Companycode",
                        "Fiscal Year": "Fiscalyear",
                        "UTR Number": "Utrnumber"
                    };
                    aData = aData.map(row => {
                        var oRow = {};
                        for (var key in row) {
                            oRow[headerMap[key] || key] = row[key];
                        }
                        return oRow;
                    });

                    that.getView().getModel("UploadModel").setData(aData);

                    jQuery.ajax({
                        url: "/sap/bc/http/sap/ZHTTP_BANK_PAYABLE",
                        method: "POST",
                        contentType: "application/json",
                        data: JSON.stringify(aData),
                        success: function () {
                            MessageToast.show("Data sent successfully!");
                            history.go(0);
                        },
                        error: function () {
                            MessageToast.show("Error sending data!");
                        }
                    });

                } catch (err) {
                    console.error(err);
                    MessageToast.show("Error reading Excel file!");
                }
            };

            reader.readAsArrayBuffer(this._file);
        }
    });
});