"use client";
import React, { useState } from "react";

interface TreeNode {
  id: string;
  name: string;
  generation: number;
  children: TreeNode[];
}

export default function TreesPage() {
  const [tree] = useState<TreeNode>({
    id: "1",
    name: "Grandfather",
    generation: 0,
    children: [
      {
        id: "2",
        name: "Father",
        generation: 1,
        children: [
          { id: "4", name: "You", generation: 2, children: [] },
          { id: "5", name: "Sibling", generation: 2, children: [] },
        ],
      },
      {
        id: "3",
        name: "Uncle",
        generation: 1,
        children: [{ id: "6", name: "Cousin", generation: 2, children: [] }],
      },
    ],
  });

  const renderNode = (node: TreeNode) => (
    <div key={node.id} className="flex flex-col items-center">
      <div className="bg-blue-500 text-white px-4 py-2 rounded-lg mb-4">
        {node.name}
      </div>
      {node.children.length > 0 && (
        <div className="flex gap-8">
          {node.children.map((child) => renderNode(child))}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8">Family Tree</h1>
      <div className="flex justify-center overflow-auto">
        {renderNode(tree)}
      </div>
    </div>
  );
}
