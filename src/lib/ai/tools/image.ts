/**
 * Image Generation Tool
 * Integrates with OpenAI DALL-E API for AI image generation
 */

import { Tool } from "../types";

export const generateImageTool: Tool = {
    definition: {
        name: "generate_image",
        description: `Generate an image from a text description using AI. Use this to create illustrations, diagrams, artwork, UI mockups, or any visual content the user requests. Returns the image URL that can be displayed.`,
        parameters: {
            type: "object",
            properties: {
                prompt: {
                    type: "string",
                    description: "A detailed description of the image to generate. Be specific about style, colors, composition, and subject matter.",
                },
                size: {
                    type: "string",
                    enum: ["1024x1024", "1792x1024", "1024x1792"],
                    description: "Image size. Use 1024x1024 for square, 1792x1024 for landscape, 1024x1792 for portrait.",
                },
                style: {
                    type: "string",
                    enum: ["vivid", "natural"],
                    description: "vivid = hyper-real and dramatic, natural = more realistic and subtle",
                },
            },
            required: ["prompt"],
        },
    },
    execute: async (args, context) => {
        const { prompt, size = "1024x1024", style = "vivid" } = args as {
            prompt: string;
            size?: string;
            style?: string;
        };

        const apiKey = context?.apiKeys?.openai;
        if (!apiKey) {
            return {
                success: false,
                error: "OpenAI API key is required for image generation. Please configure it in settings.",
            };
        }

        try {
            const response = await fetch("https://api.openai.com/v1/images/generations", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: "dall-e-3",
                    prompt,
                    n: 1,
                    size,
                    style,
                    response_format: "url",
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                return {
                    success: false,
                    error: error.error?.message || "Failed to generate image",
                };
            }

            const data = await response.json();
            const imageUrl = data.data?.[0]?.url;
            const revisedPrompt = data.data?.[0]?.revised_prompt;

            return {
                success: true,
                imageUrl,
                revisedPrompt,
                size,
                message: `Image generated successfully. The image will be displayed as an artifact.`,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to generate image",
            };
        }
    },
};

/**
 * Image Analysis Tool (Vision)
 * Analyzes images using GPT-4 Vision
 */
export const analyzeImageTool: Tool = {
    definition: {
        name: "analyze_image",
        description: "Analyze an image to describe its contents, extract text, or answer questions about it. Works with uploaded images or image URLs.",
        parameters: {
            type: "object",
            properties: {
                imageUrl: {
                    type: "string",
                    description: "URL of the image to analyze",
                },
                question: {
                    type: "string",
                    description: "Optional question to answer about the image",
                },
            },
            required: ["imageUrl"],
        },
    },
    execute: async (args, context) => {
        const { imageUrl, question = "Describe this image in detail." } = args as {
            imageUrl: string;
            question?: string;
        };

        const apiKey = context?.apiKeys?.openai;
        if (!apiKey) {
            return {
                success: false,
                error: "OpenAI API key is required for image analysis.",
            };
        }

        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: question },
                                { type: "image_url", image_url: { url: imageUrl } },
                            ],
                        },
                    ],
                    max_tokens: 1024,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                return {
                    success: false,
                    error: error.error?.message || "Failed to analyze image",
                };
            }

            const data = await response.json();
            const analysis = data.choices?.[0]?.message?.content;

            return {
                success: true,
                analysis,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to analyze image",
            };
        }
    },
};
