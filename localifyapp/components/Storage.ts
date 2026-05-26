import { Directory } from 'expo-file-system';
import { db } from '@/db/client';
import { eq } from 'drizzle-orm';
import { user } from '@/db/schema';


export const StorageUtil = {
    async SaveFolder(): Promise<string|null> 
    {

        try{
            const dir = await Directory.pickDirectoryAsync()
            if (dir && dir.uri){
                const selected_uri = dir.uri;

                db.insert(user)
                .values({id:1, folder:selected_uri})
                .onConflictDoUpdate({
                    target:user.id,
                    set: {folder:selected_uri}
                })

                return selected_uri
            }

            return null
        }

        

        catch (error) {
            console.error(error)
            return null
        }

    },

    async GetFolder(): Promise<string|null>
    {
        try{
            const res = await db.select().from(user).where(eq(user.id, 1)).limit(1)
            return res.length > 0 ? res[0].folder : null;
        }
        catch(error){
            console.error(`failed to load folder: ${error}`)
            return null
        }
    }
}