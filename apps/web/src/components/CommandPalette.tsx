import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Folder, HelpCircle, Megaphone, Sparkles } from "lucide-react";

type Tab = "actions" | "library" | "help";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("actions");
  const [query, setQuery] = useState("");

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search actions, library, help..."
        value={query}
        onValueChange={setQuery}
      />
      <div className="px-3 pt-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="actions" className="text-xs">Actions</TabsTrigger>
            <TabsTrigger value="library" className="text-xs">Library</TabsTrigger>
            <TabsTrigger value="help" className="text-xs">Help</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <CommandList className="max-h-[400px]">
        {tab === "actions" && (
          <>
            <CommandGroup heading="Quick actions">
              <CommandItem onSelect={() => go("/ads")}>
                <Megaphone className="w-4 h-4 mr-2" /> New Ads brief
              </CommandItem>
              <CommandItem onSelect={() => go("/movprompt")}>
                <Sparkles className="w-4 h-4 mr-2" /> Open MovPrompt
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {tab === "library" && (
          <CommandGroup heading="Library">
            <CommandItem onSelect={() => go("/library")}>
              <Folder className="w-4 h-4 mr-2" /> Open Library
            </CommandItem>
            <CommandEmpty>Search across your library — coming soon.</CommandEmpty>
          </CommandGroup>
        )}
        {tab === "help" && (
          <CommandGroup heading="Help">
            <CommandItem onSelect={() => go("/learn")}>
              <HelpCircle className="w-4 h-4 mr-2" /> Learn center
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
