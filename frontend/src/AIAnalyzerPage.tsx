// frontend/src/AIAnalyzerPage.tsx
import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { LoadingSpinner, MessageDisplay } from './CommonComponents';

interface AIAnalyzerPageProps {
    navigate: (page: string) => void;
}

// Helper function to convert File to Base64 string
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // Remove the "data:image/jpeg;base64," or similar prefix
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
        };
        reader.onerror = error => reject(error);
    });
};

export const AIAnalyzerPage: React.FC<AIAnalyzerPageProps> = ({ navigate }) => {
    const { user, message, setMessage } = useAuth();
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const filesArray = Array.from(event.target.files);
            // Limit to a reasonable number of images to avoid excessive payload size
            if (filesArray.length > 5) {
                setMessage({ text: 'Please select a maximum of 5 images.', type: 'warning' });
                setSelectedFiles([]);
                setImagePreviews([]);
                return;
            }
            setSelectedFiles(filesArray);

            const previews: string[] = [];
            filesArray.forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    previews.push(reader.result as string);
                    if (previews.length === filesArray.length) {
                        setImagePreviews(previews);
                    }
                };
                reader.readAsDataURL(file);
            });
            setAnalysisResult(null); // Clear previous analysis
            setMessage(null); // Clear any previous messages
        }
    };

    const handleAnalyze = async () => {
        if (selectedFiles.length === 0) {
            setMessage({ text: 'Please upload at least one dental image for analysis.', type: 'warning' });
            return;
        }

        setLoadingAnalysis(true);
        setAnalysisResult(null);
        setMessage(null);

        try {
            const imageParts = await Promise.all(
                selectedFiles.map(async (file) => {
                    const base64Data = await fileToBase64(file);
                    return {
                        inlineData: {
                            mimeType: file.type,
                            data: base64Data,
                        },
                    };
                })
            );

            const newPrompt = `You are an expert dentist. Analyze the provided dental/mouth images for any potential dental problems, issues, or areas of concern.

            **Instructions:**
            1. **Initial Assessment (Chain of Thought):** First, internally process the image by systematically examining each major area of the mouth. This includes:
                * **Teeth:** Look for signs of decay, chips, fractures, wear, discoloration, or poor alignment and any other potential concerns.
                * **Gums:** Look for inflammation, bleeding, recession, or discoloration.
                * **Tongue and other soft tissues:** Look for any lesions, growths, or unusual textures.
                * **Overall hygiene:** Assess the presence of plaque or tartar buildup.
            
            2. **Analysis and Findings:** Based on the systematic assessment, provide a detailed analysis of all findings. Present the findings in a structured, consistent format and in a language understandable by a patient.
            
            3. **Formatting:** Use the following structure for your final output to ensure clarity and consistency. Please provide a html output highlighting key areas in colors like green, orange and red and with sections and bullets:
            
                **Analysis of Dental Images**

                **I. Summary:**
                * Summary of the detailed findings.
                
                **II. General Observations:**
                * State the overall condition of the mouth (e.g., "Good overall hygiene," "Signs of significant plaque buildup").
            
                **III. Detailed Findings:**
                * **Teeth:**
                    * Use bullet points for each specific finding.
                    * Example: "Visible interproximal decay on the distal surface of the lower-left molar (#19)."
                    * Example: "Evidence of a chip on the incisal edge of the upper-right central incisor (#8)."
                * **Gums (Gingiva):**
                    * Use bullet points for each specific finding.
                    * Example: "Generalized gingivitis indicated by redness and swelling along the gum line."
                    * Example: "Localized gum recession observed around the lower-right canine (#27)."
                * **Soft Tissues (Tongue, Cheeks, etc.):**
                    * Use bullet points for each specific finding.
                    * Example: "Apparent geographic tongue with patches of smooth, red areas."
                * **Oral Hygiene:**
                    * Provide a concise summary of the hygiene level.
                    * Example: "Significant plaque accumulation noted on the lingual surfaces of the lower anterior teeth."
            
                **IV. Potential Concerns/Recommendations:**
                * List specific areas that may require a professional dental consultation.
                * Example: "Further investigation is recommended for the suspected decay on tooth #19."
                * Example: "Professional cleaning may be necessary to address plaque and tartar buildup."
            
            **Goal:** The final output should be a single, comprehensive analysis that is structured, easy to read, and consistent across different requests for the same image.`
            

            //const prompt = `Analyze the provided dental/mouth images for any potential dental problems, issues, or areas of concern. Provide a detailed analysis of findings, using as many clear headings or bullet points if applicable.`;

            let chatHistory = [];
            chatHistory.push({ role: "user", parts: [{ text: newPrompt }, ...imageParts] });

            const payload = { contents: chatHistory };
            const apiKey = "AIzaSyCwz1oMiUAGoZZtVoxzg2RZ-_LJVXR70o0"; // Canvas will inject API key at runtime
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                console.log(result.candidates[0].content.parts);
                const text = result.candidates[0].content.parts[0].text;
                // Simple Markdown to HTML conversion for bold text
                const formattedText = text; //.replace(/\*\*(.*?)\*\*/g, '<br/><br/><strong>$1</strong><br/>').replace(/\*\*(.*?)\*\*/g, '<br/>');
                setAnalysisResult(formattedText);
                setMessage({ text: 'Analysis complete!', type: 'success' });
            } else {
                setMessage({ text: 'Failed to get analysis from AI. Please try again.', type: 'error' });
                console.error("Gemini API response structure unexpected:", result);
            }

        } catch (err: any) {
            console.error("Error during AI analysis:", err);
            setMessage({ text: `Error during analysis: ${err.message}`, type: 'error' });
        } finally {
            setLoadingAnalysis(false);
        }
    };

    if (!user) {
        return <MessageDisplay message={{ text: "Please log in to use the AI Analyzer.", type: "warning" }} />;
    }

    return (
        <div className="container py-4">
            <div className="card shadow-lg p-4 p-md-5 rounded-3 mb-4">
                <h2 className="h3 fw-bold text-primary mb-4 text-center">AI Dental Analyzer</h2>
                <p className="text-muted text-center mb-4">Upload images of your mouth/teeth for an AI-powered preliminary analysis of potential dental issues. This is for informational purposes only.</p>

                <MessageDisplay message={message} />

                <div className="mb-3">
                    <label htmlFor="dentalImageUpload" className="form-label">Upload Dental Images (multiple angles recommended):</label>
                    <input
                        className="form-control"
                        type="file"
                        id="dentalImageUpload"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                    />
                    <small className="form-text text-muted">Supported formats: JPG, PNG. Max 5 images.</small>
                </div>

                {imagePreviews.length > 0 && (
                    <div className="mb-4">
                        <h5 className="mb-3">Image Previews:</h5>
                        <div className="d-flex flex-wrap justify-content-center gap-3">
                            {imagePreviews.map((src, index) => (
                                <div key={index} className="border rounded p-2 shadow-sm" style={{ width: '150px', height: '150px', overflow: 'hidden' }}>
                                    <img src={src} alt={`Dental preview ${index + 1}`} className="img-fluid rounded" style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="d-grid gap-2 mb-4">
                    <button
                        className="btn btn-success btn-lg"
                        onClick={handleAnalyze}
                        disabled={loadingAnalysis || selectedFiles.length === 0}
                    >
                        {loadingAnalysis ? <LoadingSpinner /> : 'Analyze Images with AI'}
                    </button>
                </div>

                {loadingAnalysis && (
                    <div className="text-center my-3">
                        <LoadingSpinner />
                        <p className="text-muted mt-2">Analyzing your images. This may take a moment...</p>
                    </div>
                )}

                {analysisResult && (
                    <div className="mt-4 p-4 border rounded-3 bg-light shadow-sm">
                        <h4 className="fw-bold text-success mb-3">AI Analysis Results:</h4>
                        {/* Render HTML directly using dangerouslySetInnerHTML */}
                        <div className="text-dark-emphasis" dangerouslySetInnerHTML={{ __html: analysisResult }} />
                        <hr className="my-3" />
                        <p className="text-danger small fw-bold">
                            Disclaimer: This AI analysis is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult with a qualified dental professional for accurate diagnosis and treatment plans.
                        </p>
                    </div>
                )}
                <div className='d-flex justify-content-center mt-4'>
                    <div>Schedule my home consultation <span className="blink fw-bold" onClick={() => navigate('bookService')}>Book now</span> </div>
                </div>
            </div>
            <div className="d-flex justify-content-center mt-4">
                <button className="btn btn-link" onClick={() => navigate('dashboard')}>Back to Dashboard</button>
            </div>
        </div>
    );
};
